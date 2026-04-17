import { Ticker } from 'pixi.js';

import { smokeParticleLayer } from '../sceneGraph';
import { swapRemove } from '../renderUtils';
import { type ParticleBank, createParticleBank, acquireParticle, releaseParticle, syncSprite, clearBank, texSoftBlob } from '../particlePool';
import { getStaticLights, getTransientLights, getPlayerLights } from '../lightingManager';
import { getWallAABBs } from '@simulation/player/collision';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { HALF_HIT_BOX, FOV, ROTATION_OFFSET } from '../../../constants';
import { effectsConfig } from '../config/effectsConfig';
import { lightingConfig } from '../config/lightingConfig';
import { getGraphicsConfig } from '../config/graphicsConfig';
import { GRENADE_VFX } from '@simulation/combat/grenades';

/**
 * Smoke grenade volumetric particle system.
 *
 * AABB-aware particle simulation that renders persistent smoke clouds.
 * Particles are emitted in a burst then sustained, confined within the
 * cloud radius via centering forces, and steered around walls via AABB
 * collision resolution. Supports three volumetric layers (inner/mid/outer)
 * with staged dissipation, per-particle FOW handling based on the active
 * player's view cone, CPU-side light sampling from static/dynamic/transient
 * lights, and bullet wake turbulence from passing projectiles.
 *
 * Rendering layer, part of the effects sub-system under canvas rendering.
 * Consumes SmokeVfx config from simulation/combat/grenades.ts.
 */

const vfx = GRENADE_VFX.SMOKE.cloud;

/** Returns the layer config array (3-layer or 1-layer) based on effectsConfig. */
function getLayerConfig() {
    return effectsConfig.smoke.layerCount === 3 ? vfx.layers3 : vfx.layers1;
}

/** Returns the layer weight distribution for weighted-random layer selection. */
function getLayerWeights() {
    return effectsConfig.smoke.layerCount === 3 ? vfx.layerWeights3 : vfx.layerWeights1;
}

/** Returns per-layer fade offset timings for staged dissipation. */
function getLayerFadeOffsets() {
    return effectsConfig.smoke.layerCount === 3 ? vfx.layerFadeOffsets3 : vfx.layerFadeOffsets1;
}

/**
 * Tracks the lifetime and emission state of a single smoke cloud instance.
 * Multiple clouds can be active simultaneously from different grenades.
 */
interface SmokeCloud {
    id: number;
    cx: number;
    cy: number;
    radius: number;
    expiresAt: number;
    fadeStart: number;
    emitElapsed: number;
    emitCount: number;
    emitTarget: number;
    sustainTimer: number;
    spawnTime: number;
}

let smokeBank: ParticleBank | null = null;
let particleLayer: Uint8Array | null = null;
let particleCloudId: Int32Array | null = null;
let particleBaseAlpha: Float32Array | null = null;
/** Per-particle max distance as fraction of cloud radius. */
let particleMaxRadiusFrac: Float32Array | null = null;

const activeClouds: SmokeCloud[] = [];
let nextCloudId = 1;
let frameCounter = 0;

/** Cached bullet travel direction for wake turbulence calculation. */
interface BulletDir {
    dx: number;
    dy: number;
}

const bulletDirections = new Map<number, BulletDir>();

/**
 * Lazily initializes the SoA particle bank and parallel typed arrays for
 * per-particle metadata (layer index, cloud ID, base alpha, max radius
 * fraction). Capacity is read from effectsConfig.smoke.bankCapacity.
 */
function ensureBank() {
    if (smokeBank) return;
    const cap = effectsConfig.smoke.bankCapacity;
    smokeBank = createParticleBank(cap, texSoftBlob, smokeParticleLayer);
    particleLayer = new Uint8Array(cap);
    particleCloudId = new Int32Array(cap);
    particleBaseAlpha = new Float32Array(cap);
    particleMaxRadiusFrac = new Float32Array(cap);
}

/**
 * Spawns a new smoke cloud at the given world position. The cloud will
 * burst-emit particles over emitDuration, then sustain with periodic
 * replacement particles until fadeStart, then dissipate with per-layer
 * staged fading.
 *
 * @param x - World X center of the smoke cloud
 * @param y - World Y center of the smoke cloud
 * @param radius - Cloud confinement radius
 * @param duration - Total cloud lifetime in milliseconds
 */
export function spawnSmokeCloud(x: number, y: number, radius: number, duration: number) {
    ensureBank();
    const now = performance.now();
    const emitTarget = effectsConfig.smoke.emitCountMin + Math.floor(Math.random() * (effectsConfig.smoke.emitCountMax - effectsConfig.smoke.emitCountMin + 1));

    activeClouds.push({
        id: nextCloudId++,
        cx: x,
        cy: y,
        radius,
        expiresAt: now + duration,
        fadeStart: now + duration - vfx.fadeDuration,
        emitElapsed: 0,
        emitCount: 0,
        emitTarget,
        sustainTimer: 0,
        spawnTime: now,
    });
}

/**
 * Main per-frame update for all smoke clouds and their particles. Called
 * from the render pipeline with the current timestamp and active
 * projectile list (for bullet wake turbulence).
 *
 * Handles cloud expiry, burst and sustain emission, particle physics
 * (radial confinement, drag, Brownian drift, wall collision), FOW
 * visibility, and optional CPU-side light sampling.
 *
 * @param timestamp - Current performance.now() value
 * @param projectiles - Active projectiles for bullet wake calculation
 */
export function updateSmokeParticles(timestamp: number, projectiles: readonly { id: number; x: number; y: number }[]) {
    if (!smokeBank) return;
    const dt = Ticker.shared.deltaMS;
    frameCounter++;

    for (let i = activeClouds.length - 1; i >= 0; i--) {
        if (timestamp >= activeClouds[i].expiresAt) {
            removeCloud(activeClouds[i]);
            swapRemove(activeClouds, i);
        }
    }

    for (const cloud of activeClouds) {
        cloud.emitElapsed += dt;

        // Initial burst
        if (cloud.emitElapsed < vfx.emitDuration && cloud.emitCount < cloud.emitTarget) {
            const emitRate = cloud.emitTarget / vfx.emitDuration;
            const shouldHave = Math.floor(cloud.emitElapsed * emitRate);
            while (cloud.emitCount < shouldHave && cloud.emitCount < cloud.emitTarget) {
                if (!emitParticle(cloud)) break; // bank full
            }
        }

        // Sustained replacement
        if (cloud.emitElapsed >= vfx.emitDuration && timestamp < cloud.fadeStart) {
            cloud.sustainTimer += dt;
            if (cloud.sustainTimer >= vfx.sustainInterval) {
                cloud.sustainTimer -= vfx.sustainInterval;
                emitParticle(cloud);
            }
        }
    }

    updateParticles(timestamp, projectiles);
}

/**
 * Registers a bullet's normalized travel direction for wake turbulence.
 * Called when a projectile enters or updates near a smoke cloud.
 *
 * @param bulletId - Unique projectile ID
 * @param dx - Normalized X direction component
 * @param dy - Normalized Y direction component
 */
export function trackBulletDirection(bulletId: number, dx: number, dy: number) {
    bulletDirections.set(bulletId, { dx, dy });
}

/**
 * Removes a bullet's direction tracking when the projectile is destroyed.
 *
 * @param bulletId - Unique projectile ID to stop tracking
 */
export function removeBulletDirection(bulletId: number) {
    bulletDirections.delete(bulletId);
}

/**
 * Destroys all active smoke state: clouds, particles, and bullet tracking.
 * Called on round reset or renderer teardown.
 */
export function clearSmokeEffects() {
    for (const cloud of activeClouds) removeCloud(cloud);
    activeClouds.length = 0;
    if (smokeBank) clearBank(smokeBank);
    bulletDirections.clear();
}

/**
 * Emits a single particle into the smoke bank for the given cloud.
 * Layer is selected by weighted random from getLayerWeights(). Particle
 * spawns in a tight cluster near the cloud center with small random offset
 * and slow initial velocity.
 *
 * @param cloud - The parent smoke cloud to emit into
 * @returns true if a particle was acquired, false if bank is full
 */
function emitParticle(cloud: SmokeCloud): boolean {
    if (!smokeBank || !particleLayer || !particleCloudId || !particleBaseAlpha || !particleMaxRadiusFrac) return false;

    const idx = acquireParticle(smokeBank);
    if (idx === -1) return false;

    // Pick layer by weighted random
    const weights = getLayerWeights();
    const layerCfg = getLayerConfig();
    const r = Math.random();
    let layer: number;
    if (weights.length === 1) layer = 0;
    else if (r < weights[0]) layer = 0;
    else if (r < weights[0] + weights[1]) layer = 1;
    else layer = 2;

    const cfg = layerCfg[layer];

    const angle = Math.random() * Math.PI * 2;
    const spawnDist = Math.random() * cloud.radius * vfx.initialRadiusFrac;

    smokeBank.x[idx] = cloud.cx + Math.cos(angle) * spawnDist;
    smokeBank.y[idx] = cloud.cy + Math.sin(angle) * spawnDist;
    smokeBank.vx[idx] = (Math.random() - 0.5) * vfx.initialVelocityRange;
    smokeBank.vy[idx] = (Math.random() - 0.5) * vfx.initialVelocityRange;
    smokeBank.scale[idx] = cfg.scaleMin + Math.random() * (cfg.scaleMax - cfg.scaleMin);
    smokeBank.rotation[idx] = Math.random() * Math.PI * 2;
    const baseAlpha = cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin);
    smokeBank.alpha[idx] = baseAlpha;
    smokeBank.duration[idx] = Infinity; // managed by cloud lifetime
    smokeBank.sprites[idx].tint = cfg.tint;

    particleLayer[idx] = layer;
    particleCloudId[idx] = cloud.id;
    particleBaseAlpha[idx] = baseAlpha;
    // Each particle gets its own max radius fraction with some variance
    particleMaxRadiusFrac[idx] = cfg.radiusFrac * (vfx.maxRadiusFracBase + Math.random() * vfx.maxRadiusFracRange);

    cloud.emitCount++;
    return true;
}

/**
 * Core per-particle update loop. For each alive particle:
 * 1. Finds its parent cloud (orphans are released)
 * 2. Computes cloud expansion progress (ease-out quadratic)
 * 3. Applies radial confinement (outward drift inside boundary,
 *    centering pull outside)
 * 4. Applies drag and Brownian drift
 * 5. Resolves wall AABB collisions
 * 6. Computes alpha from base, staged layer fade, and distance fade
 * 7. Applies FOW dimming based on player view cone
 * 8. Optionally samples lighting and tints the sprite
 * 9. Syncs sprite transform
 * 10. Applies bullet wake turbulence
 *
 * @param timestamp - Current performance.now() value
 * @param projectiles - Active projectiles for bullet wake
 */
function updateParticles(timestamp: number, projectiles: readonly { id: number; x: number; y: number }[]) {
    if (!smokeBank || !particleLayer || !particleCloudId || !particleBaseAlpha || !particleMaxRadiusFrac) return;

    const doLightSample = getGraphicsConfig().features.smokeLightSampling && frameCounter % effectsConfig.smoke.lightSampleInterval === 0;

    let playerX = 0,
        playerY = 0,
        facingRad = 0,
        fovHalfRad = 0;
    let hasPlayer = false;
    if (ACTIVE_PLAYER != null) {
        const p = getPlayerInfo(ACTIVE_PLAYER);
        if (p && !p.dead) {
            playerX = p.current_position.x + HALF_HIT_BOX;
            playerY = p.current_position.y + HALF_HIT_BOX;
            facingRad = ((p.current_position.rotation - ROTATION_OFFSET) * Math.PI) / 180;
            fovHalfRad = (FOV * Math.PI) / 180;
            hasPlayer = true;
        }
    }

    for (let i = smokeBank.capacity - 1; i >= 0; i--) {
        if (!smokeBank.alive[i]) continue;

        const cloudId = particleCloudId[i];
        const cloud = activeClouds.find((c) => c.id === cloudId);
        if (!cloud) {
            releaseParticle(smokeBank, i);
            continue;
        }

        // Cloud expansion progress (0 = just spawned, 1 = fully expanded)
        const expandT = Math.min(1, (timestamp - cloud.spawnTime) / vfx.expandDuration);
        // Ease-out for natural deceleration
        const expandEased = 1 - (1 - expandT) * (1 - expandT);
        const currentCloudRadius = cloud.radius * (vfx.initialRadiusFrac + (1 - vfx.initialRadiusFrac) * expandEased);

        const maxDist = currentCloudRadius * particleMaxRadiusFrac[i];

        const dx = smokeBank.x[i] - cloud.cx;
        const dy = smokeBank.y[i] - cloud.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.1) {
            const ndx = dx / dist;
            const ndy = dy / dist;

            if (dist < maxDist) {
                // Inside boundary: gentle outward drift
                smokeBank.vx[i] += ndx * vfx.radialDrift;
                smokeBank.vy[i] += ndy * vfx.radialDrift;
            }

            else {
                // Outside boundary: pull back toward center
                smokeBank.vx[i] -= ndx * vfx.centeringStrength * (dist - maxDist);
                smokeBank.vy[i] -= ndy * vfx.centeringStrength * (dist - maxDist);
            }
        }

        smokeBank.vx[i] *= vfx.particleDrag;
        smokeBank.vy[i] *= vfx.particleDrag;

        smokeBank.vx[i] += (Math.random() - 0.5) * vfx.brownianStrength;
        smokeBank.vy[i] += (Math.random() - 0.5) * vfx.brownianStrength;

        smokeBank.x[i] += smokeBank.vx[i];
        smokeBank.y[i] += smokeBank.vy[i];

        resolveWallCollision(i);

        smokeBank.rotation[i] += vfx.rotationDrift;

        // Alpha: base alpha with staged layer dissipation
        let alpha = particleBaseAlpha[i];
        if (timestamp >= cloud.fadeStart) {
            const fadeElapsed = timestamp - cloud.fadeStart;
            const layerFadeOffset = getLayerFadeOffsets()[particleLayer[i]];
            if (fadeElapsed >= vfx.fadeDuration - layerFadeOffset) {
                const layerFadeT = (fadeElapsed - (vfx.fadeDuration - layerFadeOffset)) / layerFadeOffset;
                // Distance-based: farther particles fade first
                const distFactor = dist / cloud.radius;
                const adjustedT = Math.min(1, layerFadeT + distFactor * vfx.distanceFadeFactor);
                alpha *= 1 - adjustedT;
            }
        }

        // FOW per-particle: dim particles outside player's view cone
        if (hasPlayer) {
            const dpx = smokeBank.x[i] - playerX;
            const dpy = smokeBank.y[i] - playerY;
            const angleToParticle = Math.atan2(dpy, dpx);
            let angleDiff = angleToParticle - facingRad;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > fovHalfRad) {
                alpha = Math.max(vfx.fovMinAlpha, alpha * 0.3);
            }
        }

        // CPU-side light sampling: tint sprite based on nearby light intensity
        if (doLightSample) {
            const lightMult = sampleLightAt(smokeBank.x[i], smokeBank.y[i]);
            const cfg = getLayerConfig()[particleLayer[i]];
            const baseTint = cfg.tint;
            const r = (baseTint >> 16) & 0xff;
            const g = (baseTint >> 8) & 0xff;
            const b = baseTint & 0xff;
            const lr = Math.min(255, Math.floor(r * (vfx.lightTintBase + lightMult * vfx.lightTintScale)));
            const lg = Math.min(255, Math.floor(g * (vfx.lightTintBase + lightMult * vfx.lightTintScale)));
            const lb = Math.min(255, Math.floor(b * (vfx.lightTintBase + lightMult * vfx.lightTintScale)));
            smokeBank.sprites[i].tint = (lr << 16) | (lg << 8) | lb;
        }

        smokeBank.alpha[i] = Math.max(vfx.fovMinAlpha, alpha);
        syncSprite(smokeBank, i);
    }

    applyBulletWake(projectiles);
}

let cachedWalls: readonly { x: number; y: number; w: number; h: number }[] | null = null;
let wallCacheFrame = -1;

/** Returns wall AABBs, cached per frame to avoid repeated collision queries. */
function getWalls() {
    if (wallCacheFrame !== frameCounter) {
        cachedWalls = getWallAABBs();
        wallCacheFrame = frameCounter;
    }
    return cachedWalls!;
}

/** Half of the 64px texSoftBlob texture, used as collision margin. */
const BLOB_BASE_RADIUS = 32;

/**
 * Pushes a smoke particle out of any overlapping wall AABB. Uses the
 * minimum penetration axis to resolve: the particle is placed just outside
 * the expanded AABB (wall + visual margin) and its velocity component on
 * the penetration axis is reflected with a bounce coefficient.
 *
 * @param idx - Particle index in the smoke bank
 */
function resolveWallCollision(idx: number) {
    if (!smokeBank) return;
    const px = smokeBank.x[idx];
    const py = smokeBank.y[idx];
    const margin = BLOB_BASE_RADIUS * smokeBank.scale[idx];
    const walls = getWalls();

    for (const w of walls) {
        if (px < w.x - margin || px > w.x + w.w + margin || py < w.y - margin || py > w.y + w.h + margin) continue;

        const dLeft = px - (w.x - margin);
        const dRight = w.x + w.w + margin - px;
        const dTop = py - (w.y - margin);
        const dBottom = w.y + w.h + margin - py;
        const minD = Math.min(dLeft, dRight, dTop, dBottom);

        if (minD === dLeft) {
            smokeBank.x[idx] = w.x - margin - 1;
            smokeBank.vx[idx] = -Math.abs(smokeBank.vx[idx]) * vfx.wallBounceCoefficient;
        }

        else if (minD === dRight) {
            smokeBank.x[idx] = w.x + w.w + margin + 1;
            smokeBank.vx[idx] = Math.abs(smokeBank.vx[idx]) * vfx.wallBounceCoefficient;
        }

        else if (minD === dTop) {
            smokeBank.y[idx] = w.y - margin - 1;
            smokeBank.vy[idx] = -Math.abs(smokeBank.vy[idx]) * vfx.wallBounceCoefficient;
        }

        else {
            smokeBank.y[idx] = w.y + w.h + margin + 1;
            smokeBank.vy[idx] = Math.abs(smokeBank.vy[idx]) * vfx.wallBounceCoefficient;
        }
        break;
    }
}

/**
 * Samples cumulative light intensity at a world position by iterating all
 * static, player, and transient lights. Uses inverse-square-ish falloff
 * (configurable via lightingConfig.falloffExponent). Result is clamped to
 * 3.0 to prevent oversaturation.
 *
 * @param x - World X to sample
 * @param y - World Y to sample
 * @returns Accumulated light intensity (0 to 3.0)
 */
function sampleLightAt(x: number, y: number): number {
    let total = 0;

    for (const light of getStaticLights()) {
        const dx = x - light.x;
        const dy = y - light.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < light.radius) {
            const t = dist / light.radius;
            total += light.intensity * Math.pow(1 - t * t, lightingConfig.falloffExponent);
        }
    }

    for (const [, light] of getPlayerLights()) {
        const dx = x - light.x;
        const dy = y - light.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < light.radius) {
            const t = dist / light.radius;
            total += light.intensity * Math.pow(1 - t * t, lightingConfig.falloffExponent);
        }
    }

    for (const tl of getTransientLights()) {
        const dx = x - tl.x;
        const dy = y - tl.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < tl.radius) {
            const alpha = tl.decayMs > 0 ? Math.max(0, 1 - tl.elapsed / tl.decayMs) : 1;
            const t = dist / tl.radius;
            total += tl.intensity * alpha * Math.pow(1 - t * t, lightingConfig.falloffExponent);
        }
    }

    return Math.min(total, 3.0);
}

/**
 * Applies wake turbulence from passing projectiles to nearby smoke
 * particles. Each bullet pushes particles perpendicular to its travel
 * direction (left or right depending on which side the particle is on)
 * plus a small forward component. Force falls off linearly within
 * bulletWakeRadius.
 *
 * @param projectiles - Active projectiles with position data
 */
function applyBulletWake(projectiles: readonly { id: number; x: number; y: number }[]) {
    if (!smokeBank || !particleCloudId || activeClouds.length === 0) return;

    for (const proj of projectiles) {
        const dir = bulletDirections.get(proj.id);
        if (!dir) continue;

        for (let i = 0; i < smokeBank.capacity; i++) {
            if (!smokeBank.alive[i]) continue;

            const pdx = smokeBank.x[i] - proj.x;
            const pdy = smokeBank.y[i] - proj.y;
            const dist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (dist >= vfx.bulletWakeRadius || dist < 1) continue;

            const falloff = 1 - dist / vfx.bulletWakeRadius;
            const force = vfx.bulletSmokeStrength * falloff;

            const perpX = -dir.dy;
            const perpY = dir.dx;
            const side = pdx * perpX + pdy * perpY > 0 ? 1 : -1;

            smokeBank.vx[i] += perpX * side * force + dir.dx * force * 0.3;
            smokeBank.vy[i] += perpY * side * force + dir.dy * force * 0.3;
        }
    }
}

/**
 * Releases all particles belonging to a cloud from the smoke bank.
 *
 * @param cloud - The cloud whose particles should be released
 */
function removeCloud(cloud: SmokeCloud) {
    if (!smokeBank || !particleCloudId) return;
    for (let i = 0; i < smokeBank.capacity; i++) {
        if (smokeBank.alive[i] && particleCloudId[i] === cloud.id) {
            releaseParticle(smokeBank, i);
        }
    }
}
