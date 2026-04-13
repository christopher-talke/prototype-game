import { Ticker } from 'pixi.js';
import { smokeParticleLayer } from '../sceneGraph';
import { swapRemove } from '../renderUtils';
import {
    type ParticleBank, createParticleBank, acquireParticle, releaseParticle,
    syncSprite, clearBank, texSoftBlob,
} from '../particlePool';
import { getStaticLights, getTransientLights, getPlayerLights, lightingConfig } from '../lightingManager';
import { getWallAABBs } from '@simulation/player/collision';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { HALF_HIT_BOX, FOV, ROTATION_OFFSET } from '../../../constants';

// --- Constants ---

const EXPAND_DURATION = 3000;          // ms to reach full radius
const INITIAL_RADIUS_FRAC = 0.12;     // start at 12% of target radius
const EMIT_DURATION = 1200;           // burst emission window
const EMIT_COUNT_MIN = 40;
const EMIT_COUNT_MAX = 55;
const SUSTAIN_INTERVAL = 400;         // ms between replacement particles

const RADIAL_DRIFT = 0.15;           // gentle outward push per frame
const PARTICLE_DRAG = 0.94;
const BROWNIAN_STRENGTH = 0.35;
const CENTERING_STRENGTH = 0.08;     // pull back when exceeding boundary

const FADE_DURATION = 2000;
const FOV_MIN_ALPHA = 0.08;
const LIGHT_SAMPLE_INTERVAL = 3;

const BULLET_WAKE_RADIUS = 60;
const BULLET_SMOKE_STRENGTH = 3.0;

// Layer config: inner particles stay close, outer drift far
const LAYER_CONFIG = [
    { alphaMin: 0.5, alphaMax: 0.7, scaleMin: 1.8, scaleMax: 2.4, tint: 0x445566, radiusFrac: 0.4 },
    { alphaMin: 0.3, alphaMax: 0.5, scaleMin: 1.2, scaleMax: 1.8, tint: 0x667788, radiusFrac: 0.7 },
    { alphaMin: 0.15, alphaMax: 0.3, scaleMin: 0.7, scaleMax: 1.2, tint: 0x8899aa, radiusFrac: 1.0 },
];
const LAYER_WEIGHTS = [0.3, 0.4, 0.3]; // probability distribution
const LAYER_FADE_OFFSETS = [1000, 1500, 2000]; // inner fades last

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
interface BulletDir { dx: number; dy: number }
const bulletDirections = new Map<number, BulletDir>();

const BANK_CAPACITY = 256;

function ensureBank() {
    if (smokeBank) return;
    smokeBank = createParticleBank(BANK_CAPACITY, texSoftBlob, smokeParticleLayer);
    particleLayer = new Uint8Array(BANK_CAPACITY);
    particleCloudId = new Int32Array(BANK_CAPACITY);
    particleBaseAlpha = new Float32Array(BANK_CAPACITY);
    particleMaxRadiusFrac = new Float32Array(BANK_CAPACITY);
}

// --- Public API ---

export function spawnSmokeCloud(x: number, y: number, radius: number, duration: number) {
    ensureBank();
    const now = performance.now();
    const emitTarget = EMIT_COUNT_MIN + Math.floor(Math.random() * (EMIT_COUNT_MAX - EMIT_COUNT_MIN + 1));

    activeClouds.push({
        id: nextCloudId++,
        cx: x,
        cy: y,
        radius,
        expiresAt: now + duration,
        fadeStart: now + duration - FADE_DURATION,
        emitElapsed: 0,
        emitCount: 0,
        emitTarget,
        sustainTimer: 0,
        spawnTime: now,
    });
}

export function updateSmokeParticles(
    timestamp: number,
    projectiles: readonly { id: number; x: number; y: number }[],
) {
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
        if (cloud.emitElapsed < EMIT_DURATION && cloud.emitCount < cloud.emitTarget) {
            const emitRate = cloud.emitTarget / EMIT_DURATION;
            const shouldHave = Math.floor(cloud.emitElapsed * emitRate);
            while (cloud.emitCount < shouldHave && cloud.emitCount < cloud.emitTarget) {
                if (!emitParticle(cloud)) break; // bank full
            }
        }

        // Sustained replacement
        if (cloud.emitElapsed >= EMIT_DURATION && timestamp < cloud.fadeStart) {
            cloud.sustainTimer += dt;
            if (cloud.sustainTimer >= SUSTAIN_INTERVAL) {
                cloud.sustainTimer -= SUSTAIN_INTERVAL;
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
    const r = Math.random();
    let layer: number;
    if (r < LAYER_WEIGHTS[0]) layer = 0;
    else if (r < LAYER_WEIGHTS[0] + LAYER_WEIGHTS[1]) layer = 1;
    else layer = 2;

    const cfg = LAYER_CONFIG[layer];

    // Spawn in a tight cluster around the center with small random offset
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = Math.random() * cloud.radius * INITIAL_RADIUS_FRAC;

    smokeBank.x[idx] = cloud.cx + Math.cos(angle) * spawnDist;
    smokeBank.y[idx] = cloud.cy + Math.sin(angle) * spawnDist;
    smokeBank.vx[idx] = (Math.random() - 0.5) * 0.5;
    smokeBank.vy[idx] = (Math.random() - 0.5) * 0.5;
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
    particleMaxRadiusFrac[idx] = cfg.radiusFrac * (0.7 + Math.random() * 0.6);

    cloud.emitCount++;
    return true;
}

// --- Particle update ---

function updateParticles(
    timestamp: number,
    projectiles: readonly { id: number; x: number; y: number }[],
) {
    if (!smokeBank || !particleLayer || !particleCloudId || !particleBaseAlpha || !particleMaxRadiusFrac) return;

    const doLightSample = frameCounter % LIGHT_SAMPLE_INTERVAL === 0;

    // Get player FOV data
    let playerX = 0, playerY = 0, facingRad = 0, fovHalfRad = 0;
    let hasPlayer = false;
    if (ACTIVE_PLAYER != null) {
        const p = getPlayerInfo(ACTIVE_PLAYER);
        if (p && !p.dead) {
            playerX = p.current_position.x + HALF_HIT_BOX;
            playerY = p.current_position.y + HALF_HIT_BOX;
            facingRad = (p.current_position.rotation - ROTATION_OFFSET) * Math.PI / 180;
            fovHalfRad = FOV * Math.PI / 180;
            hasPlayer = true;
        }
    }

    for (let i = smokeBank.capacity - 1; i >= 0; i--) {
        if (!smokeBank.alive[i]) continue;

        const cloudId = particleCloudId[i];
        const cloud = activeClouds.find(c => c.id === cloudId);
        if (!cloud) {
            releaseParticle(smokeBank, i);
            continue;
        }

        // Current cloud expansion progress (0 = just spawned, 1 = fully expanded)
        const expandT = Math.min(1, (timestamp - cloud.spawnTime) / EXPAND_DURATION);
        // Ease-out for natural deceleration
        const expandEased = 1 - (1 - expandT) * (1 - expandT);
        const currentCloudRadius = cloud.radius * (INITIAL_RADIUS_FRAC + (1 - INITIAL_RADIUS_FRAC) * expandEased);

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
                smokeBank.vx[i] += ndx * RADIAL_DRIFT;
                smokeBank.vy[i] += ndy * RADIAL_DRIFT;
            } else {
                // Outside boundary: pull back toward center
                smokeBank.vx[i] -= ndx * CENTERING_STRENGTH * (dist - maxDist);
                smokeBank.vy[i] -= ndy * CENTERING_STRENGTH * (dist - maxDist);
            }
        }

        // Drag
        smokeBank.vx[i] *= PARTICLE_DRAG;
        smokeBank.vy[i] *= PARTICLE_DRAG;

        // Brownian drift
        smokeBank.vx[i] += (Math.random() - 0.5) * BROWNIAN_STRENGTH;
        smokeBank.vy[i] += (Math.random() - 0.5) * BROWNIAN_STRENGTH;

        // Apply velocity
        smokeBank.x[i] += smokeBank.vx[i];
        smokeBank.y[i] += smokeBank.vy[i];

        // Wall collision: push particle out of any AABB it overlaps
        resolveWallCollision(i);

        // Slow rotation drift
        smokeBank.rotation[i] += 0.003;

        // Alpha: base alpha with dissipation
        let alpha = particleBaseAlpha[i];
        if (timestamp >= cloud.fadeStart) {
            const fadeElapsed = timestamp - cloud.fadeStart;
            const layerFadeOffset = LAYER_FADE_OFFSETS[particleLayer[i]];
            if (fadeElapsed >= FADE_DURATION - layerFadeOffset) {
                const layerFadeT = (fadeElapsed - (FADE_DURATION - layerFadeOffset)) / layerFadeOffset;
                // Distance-based: farther particles fade first
                const distFactor = dist / cloud.radius;
                const adjustedT = Math.min(1, layerFadeT + distFactor * 0.3);
                alpha *= (1 - adjustedT);
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
                alpha = Math.max(FOV_MIN_ALPHA, alpha * 0.3);
            }
        }

        // Light sampling
        if (doLightSample) {
            const lightMult = sampleLightAt(smokeBank.x[i], smokeBank.y[i]);
            const cfg = LAYER_CONFIG[particleLayer[i]];
            const baseTint = cfg.tint;
            const r = ((baseTint >> 16) & 0xff);
            const g = ((baseTint >> 8) & 0xff);
            const b = (baseTint & 0xff);
            const lr = Math.min(255, Math.floor(r * (0.5 + lightMult * 0.8)));
            const lg = Math.min(255, Math.floor(g * (0.5 + lightMult * 0.8)));
            const lb = Math.min(255, Math.floor(b * (0.5 + lightMult * 0.8)));
            smokeBank.sprites[i].tint = (lr << 16) | (lg << 8) | lb;
        }

        smokeBank.alpha[i] = Math.max(FOV_MIN_ALPHA, alpha);
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
        if (px < w.x - margin || px > w.x + w.w + margin ||
            py < w.y - margin || py > w.y + w.h + margin) continue;

        // Check if center is inside the expanded AABB
        const dLeft = px - (w.x - margin);
        const dRight = (w.x + w.w + margin) - px;
        const dTop = py - (w.y - margin);
        const dBottom = (w.y + w.h + margin) - py;
        const minD = Math.min(dLeft, dRight, dTop, dBottom);

        if (minD === dLeft) {
            smokeBank.x[idx] = w.x - margin - 1;
            smokeBank.vx[idx] = -Math.abs(smokeBank.vx[idx]) * 0.3;
        } else if (minD === dRight) {
            smokeBank.x[idx] = w.x + w.w + margin + 1;
            smokeBank.vx[idx] = Math.abs(smokeBank.vx[idx]) * 0.3;
        } else if (minD === dTop) {
            smokeBank.y[idx] = w.y - margin - 1;
            smokeBank.vy[idx] = -Math.abs(smokeBank.vy[idx]) * 0.3;
        } else {
            smokeBank.y[idx] = w.y + w.h + margin + 1;
            smokeBank.vy[idx] = Math.abs(smokeBank.vy[idx]) * 0.3;
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
            if (dist >= BULLET_WAKE_RADIUS || dist < 1) continue;

            const falloff = 1 - dist / BULLET_WAKE_RADIUS;
            const force = BULLET_SMOKE_STRENGTH * falloff;

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
