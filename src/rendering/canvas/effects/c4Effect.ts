import { Graphics, Ticker, ColorMatrixFilter, DisplacementFilter, Sprite, Texture } from 'pixi.js';
import { explosionFxLayer, sparkLayer, debrisLayer, scorchLayer, postFxLayer, worldContainer } from '../sceneGraph';
import { swapRemove } from '../renderUtils';
import { type ParticleBank, createParticleBank, acquireParticle, updateBank, clearBank, texHardDot, texShard, texSoftCircle } from '../particlePool';
import { addTransientLight } from '../lightingManager';
import { addDisplacementSource } from '../gridDisplacement';
import { addCameraShake } from '../camera';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { HALF_HIT_BOX } from '../../../constants';
import { effectsConfig } from '../config/effectsConfig';
import { getGraphicsConfig } from '../config/graphicsConfig';
import { GRENADE_VFX } from '@simulation/combat/grenades';

const vfx = GRENADE_VFX.C4.explosion;

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
    const features = getGraphicsConfig().features;
    ensureBanks();
    spawnRings(x, y, radius);
    spawnEmissiveDebris(x, y, radius);
    spawnDarkDebris(x, y, radius);
    spawnDust(x, y, radius);
    if (features.scorchDecals) spawnScorch(x, y, radius);
    if (features.heatShimmer) spawnHeatShimmer(x, y, radius);
    spawnC4Lights(x, y);
    spawnC4Displacement(x, y, radius);
    if (features.screenDesaturation) tryScreenEffects(x, y);
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
    for (let i = 0; i < vfx.ringCount; i++) {
        const delay = i * vfx.ringStaggerMs;
        setTimeout(() => createRing(x, y, radius * vfx.ringRadiusMultiplier, i), delay);
    }
}

function createRing(x: number, y: number, radius: number, index: number) {
    const strokeWidth = vfx.ringStrokeWidthMin + Math.random() * vfx.ringStrokeWidthRange;
    const color = vfx.ringColors[Math.min(index, vfx.ringColors.length - 1)];

    const g = new Graphics();
    g.circle(0, 0, radius).stroke({ color, width: strokeWidth });
    g.x = x;
    g.y = y;
    g.scale.set(vfx.ringInitialScale);
    g.alpha = 1;
    g.blendMode = vfx.ringBlendMode as any;
    explosionFxLayer.addChild(g);

    activeRings.push({ g, elapsed: 0, duration: vfx.ringDuration + Math.random() * vfx.ringDurationRange });
}

// --- Emissive debris ---

function spawnEmissiveDebris(x: number, y: number, _radius: number) {
    if (!emissiveBank) return;
    const count = effectsConfig.c4.emissiveCountMin + Math.floor(Math.random() * (effectsConfig.c4.emissiveCountMax - effectsConfig.c4.emissiveCountMin + 1));
    for (let i = 0; i < count; i++) {
        const idx = acquireParticle(emissiveBank);
        if (idx === -1) break;

        const angle = Math.random() * Math.PI * 2;
        const speed = vfx.emissiveSpeedMin + Math.random() * vfx.emissiveSpeedRange;
        emissiveBank.x[idx] = x;
        emissiveBank.y[idx] = y;
        emissiveBank.vx[idx] = Math.cos(angle) * speed;
        emissiveBank.vy[idx] = Math.sin(angle) * speed;
        emissiveBank.scale[idx] = vfx.emissiveScaleMin + Math.random() * vfx.emissiveScaleRange;
        emissiveBank.rotation[idx] = Math.random() * Math.PI * 2;
        emissiveBank.alpha[idx] = vfx.emissiveInitialAlpha;
        emissiveBank.duration[idx] = vfx.emissiveDurationMin + Math.random() * vfx.emissiveDurationRange;

        emissiveBank.sprites[idx].tint = vfx.emissiveTints[Math.floor(Math.random() * vfx.emissiveTints.length)];
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
        const speed = vfx.darkDebrisSpeedMin + Math.random() * vfx.darkDebrisSpeedRange;
        darkDebrisBank.x[idx] = x;
        darkDebrisBank.y[idx] = y;
        darkDebrisBank.vx[idx] = Math.cos(angle) * speed;
        darkDebrisBank.vy[idx] = Math.sin(angle) * speed;
        darkDebrisBank.scale[idx] = vfx.darkDebrisScaleMin + Math.random() * vfx.darkDebrisScaleRange;
        darkDebrisBank.rotation[idx] = Math.random() * Math.PI * 2;
        darkDebrisBank.alpha[idx] = vfx.darkDebrisInitialAlpha;
        darkDebrisBank.duration[idx] = vfx.darkDebrisDurationMin + Math.random() * vfx.darkDebrisDurationRange;

        darkDebrisBank.sprites[idx].tint = vfx.darkDebrisTints[Math.floor(Math.random() * vfx.darkDebrisTints.length)];
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
        const speed = vfx.dustSpeedMin + Math.random() * vfx.dustSpeedRange;
        dustBank.x[idx] = x + (Math.random() - 0.5) * radius;
        dustBank.y[idx] = y + (Math.random() - 0.5) * radius;
        dustBank.vx[idx] = Math.cos(angle) * speed;
        dustBank.vy[idx] = Math.sin(angle) * speed;
        dustBank.scale[idx] = vfx.dustScaleMin + Math.random() * vfx.dustScaleRange;
        dustBank.rotation[idx] = 0;
        dustBank.alpha[idx] = vfx.dustAlphaMin + Math.random() * vfx.dustAlphaRange;
        dustBank.duration[idx] = vfx.dustDurationMin + Math.random() * vfx.dustDurationRange;

        dustBank.sprites[idx].tint = vfx.dustTint;
    }
}

// --- Scorch decal ---

function spawnScorch(x: number, y: number, radius: number) {
    const g = new Graphics();
    g.circle(0, 0, radius * vfx.scorchInnerRadiusFrac).fill({ color: vfx.scorchInnerColor, alpha: vfx.scorchInnerAlpha });
    g.circle(0, 0, radius * vfx.scorchMiddleRadiusFrac).fill({ color: vfx.scorchOuterColor, alpha: vfx.scorchMiddleAlpha });
    g.circle(0, 0, radius * vfx.scorchOuterRadiusFrac).fill({ color: vfx.scorchOuterColor, alpha: vfx.scorchOuterAlpha });
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
    const l1 = vfx.lightPhase1;
    addTransientLight(x, y, l1.radius, l1.color, l1.intensity, l1.decay, true);
    const l2 = vfx.lightPhase2;
    setTimeout(() => {
        addTransientLight(x, y, l2.radius, l2.color, l2.intensity, l2.decay, false);
    }, l2.delay ?? 0);
}

// --- Grid displacement ---

function spawnC4Displacement(x: number, y: number, radius: number) {
    addDisplacementSource({
        x,
        y,
        radius: radius * vfx.blast.radiusMultiplier,
        strength: radius * vfx.blast.strengthMultiplier,
        duration: vfx.blast.duration,
        maxDisplacement: vfx.blast.maxDisplacement,
    });
    setTimeout(() => {
        addDisplacementSource({
            x,
            y,
            radius: radius * vfx.vacuum.radiusMultiplier,
            strength: radius * vfx.vacuum.strengthMultiplier,
            duration: vfx.vacuum.duration,
        });
    }, vfx.vacuum.delay ?? 0);
    setTimeout(() => {
        addDisplacementSource({
            x,
            y,
            radius: radius * vfx.ripple.radiusMultiplier,
            strength: radius * vfx.ripple.strengthMultiplier,
            duration: vfx.ripple.duration,
        });
    }, vfx.ripple.delay ?? 0);
}

// --- Camera shake ---

function spawnC4Shake(x: number, y: number, radius: number) {
    if (ACTIVE_PLAYER == null) return;
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) return;
    const px = p.current_position.x + HALF_HIT_BOX;
    const py = p.current_position.y + HALF_HIT_BOX;
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    const maxRange = radius * vfx.shakeRangeFactor;
    if (dist >= maxRange) return;
    const falloff = 1 - dist / maxRange;
    addCameraShake(vfx.shakeAmplitude * falloff, vfx.shakeDuration);
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

    const intensity = Math.max(vfx.desatMinIntensity, 1 - dist / effectsConfig.c4.desatRange);
    applyDesaturation(intensity);
}

function applyDesaturation(intensity: number) {
    if (!desatFilter) {
        desatFilter = new ColorMatrixFilter();
        worldContainer.filters = worldContainer.filters ? [...worldContainer.filters, desatFilter] : [desatFilter];
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
        ring.g.scale.set(vfx.ringInitialScale + (1 - vfx.ringInitialScale) * eased);
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
            bank.vx[idx] *= vfx.emissiveDrag;
            bank.vy[idx] *= vfx.emissiveDrag;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = vfx.emissiveInitialAlpha * (1 - t);
            bank.rotation[idx] += vfx.emissiveRotationSpeed;
            return true;
        });
    }

    // Update dark debris
    if (darkDebrisBank) {
        updateBank(darkDebrisBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.vx[idx] *= vfx.darkDebrisDrag;
            bank.vy[idx] = bank.vy[idx] * vfx.darkDebrisDrag + vfx.darkDebrisGravity;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = vfx.darkDebrisInitialAlpha * (1 - t);
            bank.rotation[idx] += vfx.darkDebrisRotationSpeed;
            return true;
        });
    }

    // Update dust
    if (dustBank) {
        updateBank(dustBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.vx[idx] *= vfx.dustDrag;
            bank.vy[idx] *= vfx.dustDrag;
            bank.vx[idx] += (Math.random() - 0.5) * vfx.dustBrownian;
            bank.vy[idx] += (Math.random() - 0.5) * vfx.dustBrownian;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            if (t > vfx.dustFadeThreshold) {
                bank.alpha[idx] = bank.alpha[idx] * (1 - (t - vfx.dustFadeThreshold) / (1 - vfx.dustFadeThreshold));
            }
            return true;
        });
    }
});
