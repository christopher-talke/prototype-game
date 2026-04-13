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

const vfx = GRENADE_VFX.SMOKE.cloud;

function getLayerConfig() {
    return effectsConfig.smoke.layerCount === 3 ? vfx.layers3 : vfx.layers1;
}
function getLayerWeights() {
    return effectsConfig.smoke.layerCount === 3 ? vfx.layerWeights3 : vfx.layerWeights1;
}
function getLayerFadeOffsets() {
    return effectsConfig.smoke.layerCount === 3 ? vfx.layerFadeOffsets3 : vfx.layerFadeOffsets1;
}

// --- Types ---

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

// --- State ---

let smokeBank: ParticleBank | null = null;
let particleLayer: Uint8Array | null = null;
let particleCloudId: Int32Array | null = null;
let particleBaseAlpha: Float32Array | null = null;
let particleMaxRadiusFrac: Float32Array | null = null; // per-particle max distance as fraction of cloud radius

const activeClouds: SmokeCloud[] = [];
let nextCloudId = 1;
let frameCounter = 0;

// Bullet tracking for wake turbulence
interface BulletDir {
    dx: number;
    dy: number;
}
const bulletDirections = new Map<number, BulletDir>();

function ensureBank() {
    if (smokeBank) return;
    const cap = effectsConfig.smoke.bankCapacity;
    smokeBank = createParticleBank(cap, texSoftBlob, smokeParticleLayer);
    particleLayer = new Uint8Array(cap);
    particleCloudId = new Int32Array(cap);
    particleBaseAlpha = new Float32Array(cap);
    particleMaxRadiusFrac = new Float32Array(cap);
}

// --- Public API ---

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

export function updateSmokeParticles(timestamp: number, projectiles: readonly { id: number; x: number; y: number }[]) {
    if (!smokeBank) return;
    const dt = Ticker.shared.deltaMS;
    frameCounter++;

    // Remove expired clouds
    for (let i = activeClouds.length - 1; i >= 0; i--) {
        if (timestamp >= activeClouds[i].expiresAt) {
            removeCloud(activeClouds[i]);
            swapRemove(activeClouds, i);
        }
    }

    // Emit particles for active clouds
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

export function trackBulletDirection(bulletId: number, dx: number, dy: number) {
    bulletDirections.set(bulletId, { dx, dy });
}

export function removeBulletDirection(bulletId: number) {
    bulletDirections.delete(bulletId);
}

export function clearSmokeEffects() {
    for (const cloud of activeClouds) removeCloud(cloud);
    activeClouds.length = 0;
    if (smokeBank) clearBank(smokeBank);
    bulletDirections.clear();
}

// --- Particle emission ---

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

    // Spawn in a tight cluster around the center with small random offset
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

// --- Particle update ---

function updateParticles(timestamp: number, projectiles: readonly { id: number; x: number; y: number }[]) {
    if (!smokeBank || !particleLayer || !particleCloudId || !particleBaseAlpha || !particleMaxRadiusFrac) return;

    const doLightSample = getGraphicsConfig().features.smokeLightSampling && frameCounter % effectsConfig.smoke.lightSampleInterval === 0;

    // Get player FOV data
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

        // Current cloud expansion progress (0 = just spawned, 1 = fully expanded)
        const expandT = Math.min(1, (timestamp - cloud.spawnTime) / vfx.expandDuration);
        // Ease-out for natural deceleration
        const expandEased = 1 - (1 - expandT) * (1 - expandT);
        const currentCloudRadius = cloud.radius * (vfx.initialRadiusFrac + (1 - vfx.initialRadiusFrac) * expandEased);

        // Max distance this particle should be from center
        const maxDist = currentCloudRadius * particleMaxRadiusFrac[i];

        // Distance from cloud center
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
            } else {
                // Outside boundary: pull back toward center
                smokeBank.vx[i] -= ndx * vfx.centeringStrength * (dist - maxDist);
                smokeBank.vy[i] -= ndy * vfx.centeringStrength * (dist - maxDist);
            }
        }

        // Drag
        smokeBank.vx[i] *= vfx.particleDrag;
        smokeBank.vy[i] *= vfx.particleDrag;

        // Brownian drift
        smokeBank.vx[i] += (Math.random() - 0.5) * vfx.brownianStrength;
        smokeBank.vy[i] += (Math.random() - 0.5) * vfx.brownianStrength;

        // Apply velocity
        smokeBank.x[i] += smokeBank.vx[i];
        smokeBank.y[i] += smokeBank.vy[i];

        // Wall collision: push particle out of any AABB it overlaps
        resolveWallCollision(i);

        // Slow rotation drift
        smokeBank.rotation[i] += vfx.rotationDrift;

        // Alpha: base alpha with dissipation
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

        // FOW per-particle
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

        // Light sampling
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

    // Bullet wake turbulence
    applyBulletWake(projectiles);
}

// --- Wall collision ---

let cachedWalls: readonly { x: number; y: number; w: number; h: number }[] | null = null;
let wallCacheFrame = -1;

function getWalls() {
    // Cache per frame to avoid repeated calls
    if (wallCacheFrame !== frameCounter) {
        cachedWalls = getWallAABBs();
        wallCacheFrame = frameCounter;
    }
    return cachedWalls!;
}

const BLOB_BASE_RADIUS = 32; // half of 64px texSoftBlob texture

function resolveWallCollision(idx: number) {
    if (!smokeBank) return;
    const px = smokeBank.x[idx];
    const py = smokeBank.y[idx];
    // Margin = visual radius of the blob sprite
    const margin = BLOB_BASE_RADIUS * smokeBank.scale[idx];
    const walls = getWalls();

    for (const w of walls) {
        // Expand AABB by margin for overlap test
        if (px < w.x - margin || px > w.x + w.w + margin || py < w.y - margin || py > w.y + w.h + margin) continue;

        // Check if center is inside the expanded AABB
        const dLeft = px - (w.x - margin);
        const dRight = w.x + w.w + margin - px;
        const dTop = py - (w.y - margin);
        const dBottom = w.y + w.h + margin - py;
        const minD = Math.min(dLeft, dRight, dTop, dBottom);

        if (minD === dLeft) {
            smokeBank.x[idx] = w.x - margin - 1;
            smokeBank.vx[idx] = -Math.abs(smokeBank.vx[idx]) * vfx.wallBounceCoefficient;
        } else if (minD === dRight) {
            smokeBank.x[idx] = w.x + w.w + margin + 1;
            smokeBank.vx[idx] = Math.abs(smokeBank.vx[idx]) * vfx.wallBounceCoefficient;
        } else if (minD === dTop) {
            smokeBank.y[idx] = w.y - margin - 1;
            smokeBank.vy[idx] = -Math.abs(smokeBank.vy[idx]) * vfx.wallBounceCoefficient;
        } else {
            smokeBank.y[idx] = w.y + w.h + margin + 1;
            smokeBank.vy[idx] = Math.abs(smokeBank.vy[idx]) * vfx.wallBounceCoefficient;
        }
        break;
    }
}

// --- Lighting ---

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

// --- Bullet wake ---

function applyBulletWake(projectiles: readonly { id: number; x: number; y: number }[]) {
    if (!smokeBank || !particleCloudId || activeClouds.length === 0) return;

    for (const proj of projectiles) {
        const dir = bulletDirections.get(proj.id);
        if (!dir) continue;

        // Iterate bank directly -- avoids stale index issues
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

// --- Cleanup ---

function removeCloud(cloud: SmokeCloud) {
    if (!smokeBank || !particleCloudId) return;
    for (let i = 0; i < smokeBank.capacity; i++) {
        if (smokeBank.alive[i] && particleCloudId[i] === cloud.id) {
            releaseParticle(smokeBank, i);
        }
    }
}
