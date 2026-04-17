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

/**
 * C4 explosion visual effect module.
 *
 * Renders the complete visual lifecycle of a C4 grenade detonation in the
 * PixiJS canvas renderer. Heavier than frag: 1.5x blast radius, three-phase
 * grid displacement (blast, vacuum, ripple), heat shimmer via
 * DisplacementFilter, and proximity-based screen desaturation.
 *
 * Rendering layer, part of the effects sub-system under canvas rendering.
 * Consumes C4Vfx config from simulation/combat/grenades.ts.
 */

const vfx = GRENADE_VFX.C4.explosion;

/** Active expanding shockwave ring for a C4 detonation. */
interface C4Ring {
    g: Graphics;
    elapsed: number;
    duration: number;
}

const activeRings: C4Ring[] = [];

/** Persistent ground scorch mark left by a C4 detonation. */
interface ScorchEntry {
    g: Graphics;
    elapsed: number;
}

const activeScorches: ScorchEntry[] = [];

/** Screen-space heat shimmer driven by a DisplacementFilter. */
interface ShimmerEntry {
    container: Sprite;
    filter: DisplacementFilter;
    elapsed: number;
    duration: number;
}

const activeShimmers: ShimmerEntry[] = [];

let desatFilter: ColorMatrixFilter | null = null;
let desatElapsed = 0;
let desatDuration = 0;
let desatActive = false;

let emissiveBank: ParticleBank | null = null;
let darkDebrisBank: ParticleBank | null = null;
let dustBank: ParticleBank | null = null;

/**
 * Lazily initializes the three SoA particle banks (emissive sparks, dark
 * debris, fine dust) on first C4 detonation. Capacities are read from
 * effectsConfig.c4.
 */
function ensureBanks() {
    if (emissiveBank) return;
    emissiveBank = createParticleBank(effectsConfig.c4.emissiveBankCapacity, texHardDot, sparkLayer, 'add');
    darkDebrisBank = createParticleBank(effectsConfig.c4.darkDebrisBankCapacity, texShard, debrisLayer);
    dustBank = createParticleBank(effectsConfig.c4.dustBankCapacity, texSoftCircle, debrisLayer);
}

/**
 * Spawns the full C4 explosion visual at the given world position.
 *
 * Orchestrates all sub-effects: shockwave rings, three particle types
 * (emissive, dark debris, dust), scorch decal, heat shimmer, transient
 * lighting, three-phase grid displacement, camera shake, and screen
 * desaturation. Feature toggles in graphicsConfig gate the expensive paths.
 *
 * @param x - World X of the detonation center
 * @param y - World Y of the detonation center
 * @param radius - Blast radius from grenade definition
 */
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

/**
 * Destroys all active C4 visual state: rings, scorches, shimmers,
 * particle banks, and desaturation filter. Called on round reset or
 * renderer teardown.
 */
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

/**
 * Queues staggered ring spawns. Each ring is delayed by ringStaggerMs to
 * create a cascading shockwave.
 */
function spawnRings(x: number, y: number, radius: number) {
    for (let i = 0; i < vfx.ringCount; i++) {
        const delay = i * vfx.ringStaggerMs;
        setTimeout(() => createRing(x, y, radius * vfx.ringRadiusMultiplier, i), delay);
    }
}

/**
 * Creates a single expanding shockwave ring graphic at the detonation site.
 * Color is selected by ring index from the VFX palette. Ring starts at
 * ringInitialScale and expands to full size via ease-out quadratic.
 *
 * @param x - World X center
 * @param y - World Y center
 * @param radius - Final ring radius (already scaled by ringRadiusMultiplier)
 * @param index - Ring sequence index, used to select color
 */
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

/**
 * Spawns 80-120 additive-blended emissive spark particles radiating outward
 * from the detonation center with randomized angle, speed, and tint.
 */
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

/**
 * Spawns 40-60 non-emissive dark debris shard particles that simulate
 * heavy chunks flung outward. Subject to gravity via darkDebrisGravity
 * during per-frame update.
 */
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

/**
 * Spawns 30-40 soft-circle fine dust particles scattered within the blast
 * radius. Dust drifts slowly with Brownian motion and fades after a
 * configurable threshold fraction of lifetime.
 */
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

/**
 * Draws a three-ring scorch decal on the ground at the blast center.
 * Inner, middle, and outer rings use different radii and alpha from VFX
 * config. Fades over scorchFadeDuration.
 */
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

/**
 * Creates a heat shimmer distortion at the blast site using a Pixi
 * DisplacementFilter driven by a procedurally generated noise texture.
 * The filter scale decays linearly to zero over shimmerDuration.
 *
 * @param x - World X center
 * @param y - World Y center
 * @param radius - Blast radius; shimmer covers 3x this area
 */
function spawnHeatShimmer(x: number, y: number, radius: number) {
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

    // Nearly invisible sprite acts as the filter target in postFxLayer
    const shimmerSprite = new Sprite(Texture.WHITE);
    shimmerSprite.width = radius * 3;
    shimmerSprite.height = radius * 3;
    shimmerSprite.anchor.set(0.5);
    shimmerSprite.x = x;
    shimmerSprite.y = y;
    shimmerSprite.alpha = 0.01;
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

/**
 * Adds two-phase transient lighting: an initial bright spike followed by a
 * delayed sustained glow. Phase timings and colors come from C4 VFX config.
 */
function spawnC4Lights(x: number, y: number) {
    const l1 = vfx.lightPhase1;
    addTransientLight(x, y, l1.radius, l1.color, l1.intensity, l1.decay, true);
    const l2 = vfx.lightPhase2;
    setTimeout(() => {
        addTransientLight(x, y, l2.radius, l2.color, l2.intensity, l2.decay, false);
    }, l2.delay ?? 0);
}

/**
 * Registers three sequential grid displacement sources to create the
 * characteristic C4 shockwave pattern: outward blast, inward vacuum pull,
 * then a final outward ripple. The blast phase uses maxDisplacement:42
 * to cap per-point travel.
 */
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

/**
 * Applies distance-attenuated camera shake to the active player. Shake
 * amplitude falls off linearly from vfx.shakeAmplitude at the blast
 * center to zero at radius * vfx.shakeRangeFactor.
 */
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

/**
 * Checks whether the active player is within desatRange of the blast and,
 * if so, applies a distance-attenuated desaturation filter to the world
 * container. Gated by the screenDesaturation feature toggle.
 */
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

/**
 * Attaches or updates a ColorMatrixFilter on worldContainer to desaturate
 * the scene. The filter alpha decays to zero over desatDuration in the
 * ticker loop.
 *
 * @param intensity - Initial desaturation strength (0-1)
 */
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

/** Removes the desaturation filter from worldContainer and resets state. */
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

/**
 * Per-frame ticker callback. Updates all active C4 sub-effects:
 * - Rings: ease-out quadratic scale expansion + linear alpha fade
 * - Scorches: linear alpha fade over scorchFadeDuration
 * - Heat shimmers: linear filter scale decay
 * - Desaturation: multiplicative alpha decay
 * - Emissive sparks: drag-decayed velocity + linear alpha fade + rotation
 * - Dark debris: drag + gravity + linear alpha fade + rotation
 * - Dust: drag + Brownian motion + late-life alpha fade
 */
Ticker.shared.add((ticker) => {
    const dt = ticker.deltaMS;

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

    if (desatActive && desatFilter) {
        desatElapsed += dt;
        const t = Math.min(1, desatElapsed / desatDuration);
        desatFilter.alpha = desatFilter.alpha * (1 - t);
        if (t >= 1) clearDesaturation();
    }

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
