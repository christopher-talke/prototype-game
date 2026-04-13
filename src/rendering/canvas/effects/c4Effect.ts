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
import { effectsConfig } from '../config/effectsConfig';

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
    emissiveBank = createParticleBank(effectsConfig.c4.emissiveBankCapacity, texHardDot, sparkLayer, 'add');
    darkDebrisBank = createParticleBank(effectsConfig.c4.darkDebrisBankCapacity, texShard, debrisLayer);
    dustBank = createParticleBank(effectsConfig.c4.dustBankCapacity, texSoftCircle, debrisLayer);
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
    for (let i = 0; i < effectsConfig.c4.ringCount; i++) {
        const delay = i * effectsConfig.c4.ringStaggerMs;
        setTimeout(() => createRing(x, y, radius * effectsConfig.c4.ringRadiusMultiplier, i), delay);
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

    activeRings.push({ g, elapsed: 0, duration: effectsConfig.c4.ringDuration + Math.random() * 100 });
}

// --- Emissive debris ---

function spawnEmissiveDebris(x: number, y: number, _radius: number) {
    if (!emissiveBank) return;
    const count = effectsConfig.c4.emissiveCountMin + Math.floor(Math.random() * (effectsConfig.c4.emissiveCountMax - effectsConfig.c4.emissiveCountMin + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(emissiveBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = effectsConfig.c4.emissiveSpeedMin + Math.random() * effectsConfig.c4.emissiveSpeedRange;
        emissiveBank.x[idx] = x;
        emissiveBank.y[idx] = y;
        emissiveBank.vx[idx] = Math.cos(angle) * speed;
        emissiveBank.vy[idx] = Math.sin(angle) * speed;
        emissiveBank.scale[idx] = effectsConfig.c4.emissiveScaleMin + Math.random() * effectsConfig.c4.emissiveScaleRange;
        emissiveBank.rotation[idx] = Math.random() * Math.PI * 2;
        emissiveBank.alpha[idx] = 1;
        emissiveBank.duration[idx] = effectsConfig.c4.emissiveDurationMin + Math.random() * effectsConfig.c4.emissiveDurationRange;

        const tints = [0xff6622, 0xff8844, 0xffaa55, 0xffcc88, 0xffffff];
        emissiveBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
    }
}

// --- Dark debris ---

function spawnDarkDebris(x: number, y: number, _radius: number) {
    if (!darkDebrisBank) return;
    const count = effectsConfig.c4.darkDebrisCountMin + Math.floor(Math.random() * (effectsConfig.c4.darkDebrisCountMax - effectsConfig.c4.darkDebrisCountMin + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(darkDebrisBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = effectsConfig.c4.darkDebrisSpeedMin + Math.random() * effectsConfig.c4.darkDebrisSpeedRange;
        darkDebrisBank.x[idx] = x;
        darkDebrisBank.y[idx] = y;
        darkDebrisBank.vx[idx] = Math.cos(angle) * speed;
        darkDebrisBank.vy[idx] = Math.sin(angle) * speed;
        darkDebrisBank.scale[idx] = effectsConfig.c4.darkDebrisScaleMin + Math.random() * effectsConfig.c4.darkDebrisScaleRange;
        darkDebrisBank.rotation[idx] = Math.random() * Math.PI * 2;
        darkDebrisBank.alpha[idx] = 0.9;
        darkDebrisBank.duration[idx] = effectsConfig.c4.darkDebrisDurationMin + Math.random() * effectsConfig.c4.darkDebrisDurationRange;

        const tints = [0x554433, 0x665544, 0x443322, 0x776655];
        darkDebrisBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
    }
}

// --- Fine dust ---

function spawnDust(x: number, y: number, radius: number) {
    if (!dustBank) return;
    const count = effectsConfig.c4.dustCountMin + Math.floor(Math.random() * (effectsConfig.c4.dustCountMax - effectsConfig.c4.dustCountMin + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(dustBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = effectsConfig.c4.dustSpeedMin + Math.random() * effectsConfig.c4.dustSpeedRange;
        dustBank.x[idx] = x + (Math.random() - 0.5) * radius;
        dustBank.y[idx] = y + (Math.random() - 0.5) * radius;
        dustBank.vx[idx] = Math.cos(angle) * speed;
        dustBank.vy[idx] = Math.sin(angle) * speed;
        dustBank.scale[idx] = effectsConfig.c4.dustScaleMin + Math.random() * effectsConfig.c4.dustScaleRange;
        dustBank.rotation[idx] = 0;
        dustBank.alpha[idx] = effectsConfig.c4.dustAlphaMin + Math.random() * effectsConfig.c4.dustAlphaRange;
        dustBank.duration[idx] = effectsConfig.c4.dustDurationMin + Math.random() * effectsConfig.c4.dustDurationRange;

        dustBank.sprites[idx].tint = 0x998877;
    }
}

// --- Scorch decal ---

function spawnScorch(x: number, y: number, radius: number) {
    const g = new Graphics();
    g.circle(0, 0, radius * effectsConfig.c4.scorchInnerRadiusFrac).fill({ color: 0x0a0a0a, alpha: effectsConfig.c4.scorchInnerAlpha });
    g.circle(0, 0, radius * effectsConfig.c4.scorchMiddleRadiusFrac).fill({ color: 0x111111, alpha: effectsConfig.c4.scorchMiddleAlpha });
    g.circle(0, 0, radius * effectsConfig.c4.scorchOuterRadiusFrac).fill({ color: 0x111111, alpha: effectsConfig.c4.scorchOuterAlpha });
    g.x = x;
    g.y = y;
    scorchLayer.addChild(g);
    activeScorches.push({ g, elapsed: 0 });
}

// --- Heat shimmer ---

function spawnHeatShimmer(x: number, y: number, radius: number) {
    // Create noise displacement map via Canvas 2D
    const size = effectsConfig.c4.shimmerTextureSize;
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

    const filter = new DisplacementFilter({ sprite: dispSprite, scale: effectsConfig.c4.shimmerFilterScale });

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
        duration: effectsConfig.c4.shimmerDuration,
    });
}

// --- Lighting ---

function spawnC4Lights(x: number, y: number) {
    // Phase 1: massive white-orange flash (0-200ms)
    addTransientLight(x, y, effectsConfig.c4.lightPhase1Radius, 0xffcc44, effectsConfig.c4.lightPhase1Intensity, effectsConfig.c4.lightPhase1Decay, true);
    setTimeout(() => {
        addTransientLight(x, y, effectsConfig.c4.lightPhase2Radius, 0xff4400, effectsConfig.c4.lightPhase2Intensity, effectsConfig.c4.lightPhase2Decay, false);
    }, effectsConfig.c4.lightPhase2Delay);
}

// --- Grid displacement ---

function spawnC4Displacement(x: number, y: number, radius: number) {
    addDisplacementSource({
        x, y,
        radius: radius * effectsConfig.c4.blastRadiusMultiplier,
        strength: radius * effectsConfig.c4.blastStrengthMultiplier,
        duration: effectsConfig.c4.blastDuration,
        maxDisplacement: effectsConfig.c4.blastMaxDisplacement,
    });
    setTimeout(() => {
        addDisplacementSource({
            x, y,
            radius: radius * effectsConfig.c4.vacuumRadiusMultiplier,
            strength: radius * effectsConfig.c4.vacuumStrengthMultiplier,
            duration: effectsConfig.c4.vacuumDuration,
        });
    }, effectsConfig.c4.vacuumDelay);
    setTimeout(() => {
        addDisplacementSource({
            x, y,
            radius: radius * effectsConfig.c4.rippleRadiusMultiplier,
            strength: radius * effectsConfig.c4.rippleStrengthMultiplier,
            duration: effectsConfig.c4.rippleDuration,
        });
    }, effectsConfig.c4.rippleDelay);
}

// --- Camera shake ---

function spawnC4Shake(x: number, y: number, radius: number) {
    if (ACTIVE_PLAYER == null) return;
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) return;
    const px = p.current_position.x + HALF_HIT_BOX;
    const py = p.current_position.y + HALF_HIT_BOX;
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    const maxRange = radius * effectsConfig.c4.shakeRangeFactor;
    if (dist >= maxRange) return;
    const falloff = 1 - dist / maxRange;
    addCameraShake(effectsConfig.c4.shakeAmplitude * falloff, effectsConfig.c4.shakeDuration);
}

// --- Screen effects ---

function tryScreenEffects(x: number, y: number) {
    if (ACTIVE_PLAYER == null) return;
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) return;

    const px = p.current_position.x + HALF_HIT_BOX;
    const py = p.current_position.y + HALF_HIT_BOX;
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    if (dist > effectsConfig.c4.desatRange) return;

    const intensity = Math.max(0.2, 1 - dist / effectsConfig.c4.desatRange);
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
    desatFilter.alpha = intensity * effectsConfig.c4.desatAlpha;
    desatActive = true;
    desatElapsed = 0;
    desatDuration = effectsConfig.c4.desatDuration;
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
        const t = Math.min(1, scorch.elapsed / effectsConfig.c4.scorchFadeDuration);
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
        shimmer.filter.scale.x = effectsConfig.c4.shimmerFilterScale * (1 - t);
        shimmer.filter.scale.y = effectsConfig.c4.shimmerFilterScale * (1 - t);
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
            bank.vx[idx] *= effectsConfig.c4.emissiveDrag;
            bank.vy[idx] *= effectsConfig.c4.emissiveDrag;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = 1 - t;
            bank.rotation[idx] += effectsConfig.c4.emissiveRotationSpeed;
            return true;
        });
    }

    // Update dark debris
    if (darkDebrisBank) {
        updateBank(darkDebrisBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.vx[idx] *= effectsConfig.c4.darkDebrisDrag;
            bank.vy[idx] = bank.vy[idx] * effectsConfig.c4.darkDebrisDrag + effectsConfig.c4.darkDebrisGravity;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = 0.9 * (1 - t);
            bank.rotation[idx] += effectsConfig.c4.darkDebrisRotationSpeed;
            return true;
        });
    }

    // Update dust
    if (dustBank) {
        updateBank(dustBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.vx[idx] *= effectsConfig.c4.dustDrag;
            bank.vy[idx] *= effectsConfig.c4.dustDrag;
            bank.vx[idx] += (Math.random() - 0.5) * effectsConfig.c4.dustBrownian;
            bank.vy[idx] += (Math.random() - 0.5) * effectsConfig.c4.dustBrownian;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            if (t > effectsConfig.c4.dustFadeThreshold) {
                bank.alpha[idx] = bank.alpha[idx] * (1 - (t - effectsConfig.c4.dustFadeThreshold) / (1 - effectsConfig.c4.dustFadeThreshold));
            }
            return true;
        });
    }
});
