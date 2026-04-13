import { Graphics, Ticker } from 'pixi.js';
import { explosionFxLayer, sparkLayer, debrisLayer, scorchLayer } from '../sceneGraph';
import { swapRemove } from '../renderUtils';
import {
    type ParticleBank, createParticleBank, acquireParticle, updateBank,
    clearBank, texHardDot, texShard, texStreak,
} from '../particlePool';
import { addTransientLight } from '../lightingManager';
import { addDisplacementSource } from '../gridDisplacement';
import { addCameraShake } from '../camera';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { HALF_HIT_BOX } from '../../../constants';

// --- Constants ---

const RING_COUNT_MIN = 3;
const RING_COUNT_MAX = 5;
const RING_STAGGER_MS = 35;
const RING_DURATION_MIN = 300;
const RING_DURATION_MAX = 500;

const EMISSIVE_COUNT_MIN = 40;
const EMISSIVE_COUNT_MAX = 60;
const DARK_DEBRIS_COUNT_MIN = 15;
const DARK_DEBRIS_COUNT_MAX = 25;

const SCORCH_FADE_DURATION = 8000;

const SECONDARY_SPARK_CHANCE = 0.15;
const SECONDARY_SPARK_INTERVAL = 3; // every N frames

// --- Shockwave ring state ---

interface RingEntry {
    g: Graphics;
    elapsed: number;
    duration: number;
    radius: number;
    x: number;
    y: number;
    displacementId: number;
}

const activeRings: RingEntry[] = [];

// --- Scorch decal state ---

interface ScorchEntry {
    g: Graphics;
    elapsed: number;
}

const activeScorches: ScorchEntry[] = [];

// --- Particle banks (lazy init) ---

let emissiveBank: ParticleBank | null = null;
let darkDebrisBank: ParticleBank | null = null;
let secondarySparkBank: ParticleBank | null = null;

let frameCounter = 0;

function ensureBanks() {
    if (emissiveBank) return;
    emissiveBank = createParticleBank(256, texHardDot, sparkLayer, 'add');
    darkDebrisBank = createParticleBank(128, texShard, debrisLayer);
    secondarySparkBank = createParticleBank(128, texStreak, sparkLayer, 'add');
}

// --- Public API ---

export function spawnFragExplosion(x: number, y: number, radius: number) {
    ensureBanks();
    spawnRings(x, y, radius);
    spawnEmissiveDebris(x, y, radius);
    spawnDarkDebris(x, y, radius);
    spawnScorch(x, y, radius);
    spawnFragLights(x, y);
    spawnFragDisplacement(x, y, radius);
    spawnFragShake(x, y, radius);
}

export function clearFragEffects() {
    for (const ring of activeRings) ring.g.destroy();
    activeRings.length = 0;
    for (const scorch of activeScorches) scorch.g.destroy();
    activeScorches.length = 0;
    if (emissiveBank) clearBank(emissiveBank);
    if (darkDebrisBank) clearBank(darkDebrisBank);
    if (secondarySparkBank) clearBank(secondarySparkBank);
}

// --- Shockwave rings ---

function spawnRings(x: number, y: number, radius: number) {
    const count = RING_COUNT_MIN + Math.floor(Math.random() * (RING_COUNT_MAX - RING_COUNT_MIN + 1));
    for (let i = 0; i < count; i++) {
        const delay = i * RING_STAGGER_MS;
        setTimeout(() => createRing(x, y, radius, i), delay);
    }
}

function createRing(x: number, y: number, radius: number, index: number) {
    const duration = RING_DURATION_MIN + Math.random() * (RING_DURATION_MAX - RING_DURATION_MIN);
    const strokeWidth = 4 + Math.random() * 3;
    // Vary color slightly per ring: orange to yellow
    const colors = [0xff9500, 0xffaa22, 0xff8800, 0xffbb33, 0xff7700];
    const color = colors[index % colors.length];

    const g = new Graphics();
    g.circle(0, 0, radius).stroke({ color, width: strokeWidth });
    g.x = x;
    g.y = y;
    g.scale.set(0.05);
    g.alpha = 1;
    g.blendMode = 'add';
    explosionFxLayer.addChild(g);

    // Each ring drives its own displacement at the ring's current radius
    const displacementId = addDisplacementSource({
        x, y,
        radius: radius * 0.3,
        strength: radius * 12,
        duration: duration,
    });

    activeRings.push({ g, elapsed: 0, duration, radius, x, y, displacementId });
}

// --- Emissive debris (sparks) ---

function spawnEmissiveDebris(x: number, y: number, _radius: number) {
    if (!emissiveBank) return;
    const count = EMISSIVE_COUNT_MIN + Math.floor(Math.random() * (EMISSIVE_COUNT_MAX - EMISSIVE_COUNT_MIN + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(emissiveBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        emissiveBank.x[idx] = x;
        emissiveBank.y[idx] = y;
        emissiveBank.vx[idx] = Math.cos(angle) * speed;
        emissiveBank.vy[idx] = Math.sin(angle) * speed;
        emissiveBank.scale[idx] = 0.8 + Math.random() * 0.6;
        emissiveBank.rotation[idx] = Math.random() * Math.PI * 2;
        emissiveBank.alpha[idx] = 1;
        emissiveBank.duration[idx] = 400 + Math.random() * 400;

        // Tint: orange-yellow-white gradient
        const tints = [0xffaa33, 0xffcc44, 0xffdd66, 0xffeebb, 0xffffff];
        emissiveBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
    }
}

// --- Dark debris (non-emissive chunks) ---

function spawnDarkDebris(x: number, y: number, _radius: number) {
    if (!darkDebrisBank) return;
    const count = DARK_DEBRIS_COUNT_MIN + Math.floor(Math.random() * (DARK_DEBRIS_COUNT_MAX - DARK_DEBRIS_COUNT_MIN + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(darkDebrisBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        darkDebrisBank.x[idx] = x;
        darkDebrisBank.y[idx] = y;
        darkDebrisBank.vx[idx] = Math.cos(angle) * speed;
        darkDebrisBank.vy[idx] = Math.sin(angle) * speed;
        darkDebrisBank.scale[idx] = 0.6 + Math.random() * 0.8;
        darkDebrisBank.rotation[idx] = Math.random() * Math.PI * 2;
        darkDebrisBank.alpha[idx] = 0.9;
        darkDebrisBank.duration[idx] = 500 + Math.random() * 500;

        // Gray-brown tints
        const tints = [0x665544, 0x776655, 0x554433, 0x887766];
        darkDebrisBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
    }
}

// --- Scorch decal ---

function spawnScorch(x: number, y: number, radius: number) {
    const g = new Graphics();
    // Dark center fading to transparent
    g.circle(0, 0, radius * 0.3).fill({ color: 0x111111, alpha: 0.6 });
    g.circle(0, 0, radius * 0.6).fill({ color: 0x111111, alpha: 0.3 });
    g.circle(0, 0, radius).fill({ color: 0x111111, alpha: 0.1 });
    g.x = x;
    g.y = y;
    scorchLayer.addChild(g);
    activeScorches.push({ g, elapsed: 0 });
}

// --- Lighting ---

function spawnFragLights(x: number, y: number) {
    // Phase 1: bright spike (0-80ms)
    addTransientLight(x, y, 500, 0xffcc66, 5.0, 80, true);
    // Phase 2: orange-red decay (80-300ms), spawned with delay
    setTimeout(() => {
        addTransientLight(x, y, 400, 0xff6622, 2.5, 220, true);
    }, 80);
}

// --- Grid displacement ---

function spawnFragDisplacement(x: number, y: number, radius: number) {
    // Phase 1: outward blast (immediate)
    addDisplacementSource({
        x, y,
        radius: radius * 2,
        strength: radius * 50,
        duration: 400,
    });
    // Phase 2: vacuum pull (200ms delay)
    setTimeout(() => {
        addDisplacementSource({
            x, y,
            radius: radius * 1.5,
            strength: radius * -15,
            duration: 300,
        });
    }, 200);
}

// --- Camera shake ---

function spawnFragShake(x: number, y: number, radius: number) {
    if (ACTIVE_PLAYER == null) return;
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) return;
    const px = p.current_position.x + HALF_HIT_BOX;
    const py = p.current_position.y + HALF_HIT_BOX;
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    const maxRange = radius * 5;
    if (dist >= maxRange) return;
    const falloff = 1 - dist / maxRange;
    addCameraShake(16 * falloff, 400);
}

// --- Ticker update ---

Ticker.shared.add((ticker) => {
    const dt = ticker.deltaMS;
    frameCounter++;

    // Update shockwave rings
    for (let i = activeRings.length - 1; i >= 0; i--) {
        const ring = activeRings[i];
        ring.elapsed += dt;
        const t = Math.min(1, ring.elapsed / ring.duration);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        ring.g.scale.set(0.05 + 0.95 * eased);
        ring.g.alpha = 1 - t;
        if (t >= 1) {
            ring.g.destroy();
            swapRemove(activeRings, i);
        }
    }

    // Update scorch decals
    for (let i = activeScorches.length - 1; i >= 0; i--) {
        const scorch = activeScorches[i];
        scorch.elapsed += dt;
        const t = Math.min(1, scorch.elapsed / SCORCH_FADE_DURATION);
        scorch.g.alpha = 1 - t;
        if (t >= 1) {
            scorch.g.destroy();
            swapRemove(activeScorches, i);
        }
    }

    // Update emissive debris
    if (emissiveBank) {
        updateBank(emissiveBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            // Drag
            bank.vx[idx] *= 0.94;
            bank.vy[idx] *= 0.94;
            // Move
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            // Fade
            bank.alpha[idx] = 1 - t;
            // Spin
            bank.rotation[idx] += 0.05;

            // Secondary spark emission
            if (secondarySparkBank && frameCounter % SECONDARY_SPARK_INTERVAL === 0 && Math.random() < SECONDARY_SPARK_CHANCE) {
                const si = acquireParticle(secondarySparkBank);
                if (si !== -1) {
                    secondarySparkBank.x[si] = bank.x[idx];
                    secondarySparkBank.y[si] = bank.y[idx];
                    secondarySparkBank.vx[si] = (Math.random() - 0.5) * 2;
                    secondarySparkBank.vy[si] = (Math.random() - 0.5) * 2;
                    secondarySparkBank.scale[si] = 0.3 + Math.random() * 0.3;
                    secondarySparkBank.rotation[si] = Math.random() * Math.PI * 2;
                    secondarySparkBank.alpha[si] = 0.8;
                    secondarySparkBank.duration[si] = 100 + Math.random() * 100;
                    secondarySparkBank.sprites[si].tint = 0xffdd88;
                }
            }
            return true;
        });
    }

    // Update dark debris
    if (darkDebrisBank) {
        updateBank(darkDebrisBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            // Drag + gravity
            bank.vx[idx] *= 0.92;
            bank.vy[idx] = bank.vy[idx] * 0.92 + 0.15;
            // Move
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            // Fade
            bank.alpha[idx] = 0.9 * (1 - t);
            // Spin
            bank.rotation[idx] += 0.08;
            return true;
        });
    }

    // Update secondary sparks
    if (secondarySparkBank) {
        updateBank(secondarySparkBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = 0.8 * (1 - t);
            bank.scale[idx] *= 0.97;
            return true;
        });
    }
});
