import { Graphics, Ticker, ColorMatrixFilter, DisplacementFilter, Sprite, Texture } from 'pixi.js';
import { explosionFxLayer, sparkLayer, debrisLayer, scorchLayer, postFxLayer, worldContainer } from '../sceneGraph';
import { swapRemove } from '../renderUtils';
import {
    type ParticleBank, createParticleBank, acquireParticle, updateBank,
    clearBank, texHardDot, texShard, texSoftCircle,
} from '../particlePool';
import { addTransientLight } from '../lightingManager';
import { addDisplacementSource } from '../gridDisplacement';
import { addCameraShake } from '../camera';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { HALF_HIT_BOX } from '../../../constants';

// --- Constants ---

const RING_COUNT = 2;
const RING_DURATION = 700;

const EMISSIVE_COUNT_MIN = 80;
const EMISSIVE_COUNT_MAX = 120;
const DARK_DEBRIS_COUNT_MIN = 40;
const DARK_DEBRIS_COUNT_MAX = 60;
const DUST_COUNT_MIN = 30;
const DUST_COUNT_MAX = 40;

const SCORCH_FADE_DURATION = 10000;
const SHIMMER_DURATION = 2500;
const DESAT_DURATION = 1500;
const DESAT_RANGE = 600;

// --- Shockwave ring state ---

interface C4Ring {
    g: Graphics;
    elapsed: number;
    duration: number;
}

const activeRings: C4Ring[] = [];

// --- Scorch state ---

interface ScorchEntry {
    g: Graphics;
    elapsed: number;
}

const activeScorches: ScorchEntry[] = [];

// --- Heat shimmer state ---

interface ShimmerEntry {
    container: Sprite;
    filter: DisplacementFilter;
    elapsed: number;
    duration: number;
}

const activeShimmers: ShimmerEntry[] = [];

// --- Screen effect state ---

let desatFilter: ColorMatrixFilter | null = null;
let desatElapsed = 0;
let desatDuration = 0;
let desatActive = false;

// --- Particle banks (lazy init) ---

let emissiveBank: ParticleBank | null = null;
let darkDebrisBank: ParticleBank | null = null;
let dustBank: ParticleBank | null = null;

function ensureBanks() {
    if (emissiveBank) return;
    emissiveBank = createParticleBank(256, texHardDot, sparkLayer, 'add');
    darkDebrisBank = createParticleBank(128, texShard, debrisLayer);
    dustBank = createParticleBank(64, texSoftCircle, debrisLayer);
}

// --- Public API ---

export function spawnC4Explosion(x: number, y: number, radius: number) {
    ensureBanks();
    spawnRings(x, y, radius);
    spawnEmissiveDebris(x, y, radius);
    spawnDarkDebris(x, y, radius);
    spawnDust(x, y, radius);
    spawnScorch(x, y, radius);
    spawnHeatShimmer(x, y, radius);
    spawnC4Lights(x, y);
    spawnC4Displacement(x, y, radius);
    tryScreenEffects(x, y);
    spawnC4Shake(x, y, radius);
}

export function clearC4Effects() {
    for (const ring of activeRings) ring.g.destroy();
    activeRings.length = 0;
    for (const scorch of activeScorches) scorch.g.destroy();
    activeScorches.length = 0;
    for (const shimmer of activeShimmers) {
        shimmer.container.destroy();
    }
    activeShimmers.length = 0;
    if (emissiveBank) clearBank(emissiveBank);
    if (darkDebrisBank) clearBank(darkDebrisBank);
    if (dustBank) clearBank(dustBank);
    clearDesaturation();
}

// --- Shockwave rings ---

function spawnRings(x: number, y: number, radius: number) {
    for (let i = 0; i < RING_COUNT; i++) {
        const delay = i * 80;
        setTimeout(() => createRing(x, y, radius * 1.5, i), delay);
    }
}

function createRing(x: number, y: number, radius: number, index: number) {
    const strokeWidth = 6 + Math.random() * 2;
    const color = index === 0 ? 0xff4400 : 0xff6622;

    const g = new Graphics();
    g.circle(0, 0, radius).stroke({ color, width: strokeWidth });
    g.x = x;
    g.y = y;
    g.scale.set(0.05);
    g.alpha = 1;
    g.blendMode = 'add';
    explosionFxLayer.addChild(g);

    activeRings.push({ g, elapsed: 0, duration: RING_DURATION + Math.random() * 100 });
}

// --- Emissive debris ---

function spawnEmissiveDebris(x: number, y: number, _radius: number) {
    if (!emissiveBank) return;
    const count = EMISSIVE_COUNT_MIN + Math.floor(Math.random() * (EMISSIVE_COUNT_MAX - EMISSIVE_COUNT_MIN + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(emissiveBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 10;
        emissiveBank.x[idx] = x;
        emissiveBank.y[idx] = y;
        emissiveBank.vx[idx] = Math.cos(angle) * speed;
        emissiveBank.vy[idx] = Math.sin(angle) * speed;
        emissiveBank.scale[idx] = 1.0 + Math.random() * 0.8;
        emissiveBank.rotation[idx] = Math.random() * Math.PI * 2;
        emissiveBank.alpha[idx] = 1;
        emissiveBank.duration[idx] = 500 + Math.random() * 600;

        const tints = [0xff6622, 0xff8844, 0xffaa55, 0xffcc88, 0xffffff];
        emissiveBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
    }
}

// --- Dark debris ---

function spawnDarkDebris(x: number, y: number, _radius: number) {
    if (!darkDebrisBank) return;
    const count = DARK_DEBRIS_COUNT_MIN + Math.floor(Math.random() * (DARK_DEBRIS_COUNT_MAX - DARK_DEBRIS_COUNT_MIN + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(darkDebrisBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        darkDebrisBank.x[idx] = x;
        darkDebrisBank.y[idx] = y;
        darkDebrisBank.vx[idx] = Math.cos(angle) * speed;
        darkDebrisBank.vy[idx] = Math.sin(angle) * speed;
        darkDebrisBank.scale[idx] = 0.8 + Math.random() * 1.0;
        darkDebrisBank.rotation[idx] = Math.random() * Math.PI * 2;
        darkDebrisBank.alpha[idx] = 0.9;
        darkDebrisBank.duration[idx] = 600 + Math.random() * 600;

        const tints = [0x554433, 0x665544, 0x443322, 0x776655];
        darkDebrisBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
    }
}

// --- Fine dust ---

function spawnDust(x: number, y: number, radius: number) {
    if (!dustBank) return;
    const count = DUST_COUNT_MIN + Math.floor(Math.random() * (DUST_COUNT_MAX - DUST_COUNT_MIN + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(dustBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5;
        dustBank.x[idx] = x + (Math.random() - 0.5) * radius;
        dustBank.y[idx] = y + (Math.random() - 0.5) * radius;
        dustBank.vx[idx] = Math.cos(angle) * speed;
        dustBank.vy[idx] = Math.sin(angle) * speed;
        dustBank.scale[idx] = 0.3 + Math.random() * 0.4;
        dustBank.rotation[idx] = 0;
        dustBank.alpha[idx] = 0.2 + Math.random() * 0.2;
        dustBank.duration[idx] = 3000 + Math.random() * 1000;

        dustBank.sprites[idx].tint = 0x998877;
    }
}

// --- Scorch decal ---

function spawnScorch(x: number, y: number, radius: number) {
    const g = new Graphics();
    g.circle(0, 0, radius * 0.4).fill({ color: 0x0a0a0a, alpha: 0.7 });
    g.circle(0, 0, radius * 0.7).fill({ color: 0x111111, alpha: 0.4 });
    g.circle(0, 0, radius * 1.2).fill({ color: 0x111111, alpha: 0.15 });
    g.x = x;
    g.y = y;
    scorchLayer.addChild(g);
    activeScorches.push({ g, elapsed: 0 });
}

// --- Heat shimmer ---

function spawnHeatShimmer(x: number, y: number, radius: number) {
    // Create noise displacement map via Canvas 2D
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const val = 128 + (Math.random() - 0.5) * 60;
        imageData.data[i] = val;
        imageData.data[i + 1] = val;
        imageData.data[i + 2] = val;
        imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    const dispTexture = Texture.from(canvas);
    const dispSprite = new Sprite(dispTexture);
    dispSprite.anchor.set(0.5);

    const filter = new DisplacementFilter({ sprite: dispSprite, scale: 15 });

    // Apply the filter to the postFxLayer area
    const shimmerSprite = new Sprite(Texture.WHITE);
    shimmerSprite.width = radius * 3;
    shimmerSprite.height = radius * 3;
    shimmerSprite.anchor.set(0.5);
    shimmerSprite.x = x;
    shimmerSprite.y = y;
    shimmerSprite.alpha = 0.01; // nearly invisible but filter target
    shimmerSprite.filters = [filter];
    postFxLayer.addChild(shimmerSprite);
    postFxLayer.addChild(dispSprite);

    activeShimmers.push({
        container: shimmerSprite,
        filter,
        elapsed: 0,
        duration: SHIMMER_DURATION,
    });
}

// --- Lighting ---

function spawnC4Lights(x: number, y: number) {
    // Phase 1: massive white-orange flash (0-200ms)
    addTransientLight(x, y, 600, 0xffcc44, 6.0, 200, true);
    // Phase 2: sustained orange-red glow (200-1000ms), no shadow = bleeds through walls
    setTimeout(() => {
        addTransientLight(x, y, 500, 0xff4400, 2.5, 800, false);
    }, 200);
}

// --- Grid displacement ---

function spawnC4Displacement(x: number, y: number, radius: number) {
    // Phase 1: massive outward (immediate)
    addDisplacementSource({
        x, y,
        radius: radius * 2.5,
        strength: radius * 100,
        duration: 600,
        maxDisplacement: 42,
    });
    // Phase 2: vacuum pull (300ms delay)
    setTimeout(() => {
        addDisplacementSource({
            x, y,
            radius: radius * 2,
            strength: radius * -35,
            duration: 400,
        });
    }, 300);
    // Phase 3: secondary ripple (700ms delay)
    setTimeout(() => {
        addDisplacementSource({
            x, y,
            radius: radius * 1.5,
            strength: radius * 20,
            duration: 350,
        });
    }, 700);
}

// --- Camera shake ---

function spawnC4Shake(x: number, y: number, radius: number) {
    if (ACTIVE_PLAYER == null) return;
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) return;
    const px = p.current_position.x + HALF_HIT_BOX;
    const py = p.current_position.y + HALF_HIT_BOX;
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    const maxRange = radius * 6;
    if (dist >= maxRange) return;
    const falloff = 1 - dist / maxRange;
    addCameraShake(32 * falloff, 800);
}

// --- Screen effects ---

function tryScreenEffects(x: number, y: number) {
    if (ACTIVE_PLAYER == null) return;
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) return;

    const px = p.current_position.x + HALF_HIT_BOX;
    const py = p.current_position.y + HALF_HIT_BOX;
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    if (dist > DESAT_RANGE) return;

    const intensity = Math.max(0.2, 1 - dist / DESAT_RANGE);
    applyDesaturation(intensity);
}

function applyDesaturation(intensity: number) {
    if (!desatFilter) {
        desatFilter = new ColorMatrixFilter();
        worldContainer.filters = worldContainer.filters
            ? [...worldContainer.filters, desatFilter]
            : [desatFilter];
    }
    desatFilter.desaturate();
    desatFilter.alpha = intensity * 0.8;
    desatActive = true;
    desatElapsed = 0;
    desatDuration = DESAT_DURATION;
}

function clearDesaturation() {
    if (desatFilter && worldContainer.filters) {
        const idx = worldContainer.filters.indexOf(desatFilter);
        if (idx >= 0) {
            const arr = [...worldContainer.filters];
            arr.splice(idx, 1);
            worldContainer.filters = arr.length > 0 ? arr : null;
        }
        desatFilter = null;
    }
    desatActive = false;
}

// --- Ticker update ---

Ticker.shared.add((ticker) => {
    const dt = ticker.deltaMS;

    // Update rings
    for (let i = activeRings.length - 1; i >= 0; i--) {
        const ring = activeRings[i];
        ring.elapsed += dt;
        const t = Math.min(1, ring.elapsed / ring.duration);
        const eased = 1 - Math.pow(1 - t, 2); // ease-out quadratic (slower than frag)
        ring.g.scale.set(0.05 + 0.95 * eased);
        ring.g.alpha = 1 - t;
        if (t >= 1) {
            ring.g.destroy();
            swapRemove(activeRings, i);
        }
    }

    // Update scorches
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

    // Update heat shimmers
    for (let i = activeShimmers.length - 1; i >= 0; i--) {
        const shimmer = activeShimmers[i];
        shimmer.elapsed += dt;
        const t = Math.min(1, shimmer.elapsed / shimmer.duration);
        shimmer.filter.scale.x = 15 * (1 - t);
        shimmer.filter.scale.y = 15 * (1 - t);
        if (t >= 1) {
            shimmer.container.destroy();
            swapRemove(activeShimmers, i);
        }
    }

    // Update desaturation
    if (desatActive && desatFilter) {
        desatElapsed += dt;
        const t = Math.min(1, desatElapsed / desatDuration);
        desatFilter.alpha = desatFilter.alpha * (1 - t);
        if (t >= 1) clearDesaturation();
    }

    // Update emissive debris
    if (emissiveBank) {
        updateBank(emissiveBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.vx[idx] *= 0.93;
            bank.vy[idx] *= 0.93;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = 1 - t;
            bank.rotation[idx] += 0.06;
            return true;
        });
    }

    // Update dark debris
    if (darkDebrisBank) {
        updateBank(darkDebrisBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.vx[idx] *= 0.90;
            bank.vy[idx] = bank.vy[idx] * 0.90 + 0.18;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = 0.9 * (1 - t);
            bank.rotation[idx] += 0.1;
            return true;
        });
    }

    // Update dust
    if (dustBank) {
        updateBank(dustBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.vx[idx] *= 0.98;
            bank.vy[idx] *= 0.98;
            // Brownian drift
            bank.vx[idx] += (Math.random() - 0.5) * 0.1;
            bank.vy[idx] += (Math.random() - 0.5) * 0.1;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            // Fade in last third
            if (t > 0.7) {
                bank.alpha[idx] = bank.alpha[idx] * (1 - (t - 0.7) / 0.3);
            }
            return true;
        });
    }
});
