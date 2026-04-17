import { Graphics, Ticker } from 'pixi.js';

import { explosionFxLayer, sparkLayer, debrisLayer, scorchLayer } from '../sceneGraph';
import { swapRemove } from '../renderUtils';
import { type ParticleBank, createParticleBank, acquireParticle, updateBank, clearBank, texHardDot, texShard, texStreak } from '../particlePool';
import { addTransientLight } from '../lightingManager';
import { addDisplacementSource } from '../gridDisplacement';
import { addCameraShake } from '../camera';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { HALF_HIT_BOX } from '../../../constants';
import { effectsConfig } from '../config/effectsConfig';
import { getGraphicsConfig } from '../config/graphicsConfig';
import { GRENADE_VFX } from '@simulation/combat/grenades';

/**
 * Frag grenade explosion visual effect module.
 *
 * Renders the complete visual lifecycle of a fragmentation grenade
 * detonation in the PixiJS canvas renderer. Produces 3-5 staggered
 * shockwave rings (each driving its own grid displacement source),
 * 40-60 emissive sparks with optional secondary spark emission from
 * debris, 15-25 dark debris chunks with gravity, scorch decals,
 * two-phase transient lighting, two-phase grid displacement (outward
 * blast + inward vacuum), and distance-attenuated camera shake.
 *
 * Rendering layer, part of the effects sub-system under canvas rendering.
 * Consumes FragVfx config from simulation/combat/grenades.ts.
 */

const vfx = GRENADE_VFX.FRAG.explosion;

/**
 * Active expanding shockwave ring with its own grid displacement source.
 * Each ring tracks its world position so displacement can be centered
 * correctly.
 */
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

/** Persistent ground scorch mark left by a frag detonation. */
interface ScorchEntry {
    g: Graphics;
    elapsed: number;
}

const activeScorches: ScorchEntry[] = [];

let emissiveBank: ParticleBank | null = null;
let darkDebrisBank: ParticleBank | null = null;
let secondarySparkBank: ParticleBank | null = null;

let frameCounter = 0;

/**
 * Lazily initializes the three SoA particle banks (emissive sparks, dark
 * debris shards, secondary streak sparks) on first frag detonation.
 * Capacities are read from effectsConfig.frag.
 */
function ensureBanks() {
    if (emissiveBank) return;
    emissiveBank = createParticleBank(effectsConfig.frag.emissiveBankCapacity, texHardDot, sparkLayer, 'add');
    darkDebrisBank = createParticleBank(effectsConfig.frag.darkDebrisBankCapacity, texShard, debrisLayer);
    secondarySparkBank = createParticleBank(effectsConfig.frag.secondarySparkBankCapacity, texStreak, sparkLayer, 'add');
}

/**
 * Spawns the full frag explosion visual at the given world position.
 *
 * Orchestrates all sub-effects: staggered shockwave rings (each with its
 * own displacement source), emissive sparks, dark debris, scorch decal,
 * two-phase transient lighting, two-phase grid displacement (blast +
 * vacuum), and camera shake. The scorchDecals feature toggle gates the
 * decal path.
 *
 * @param x - World X of the detonation center
 * @param y - World Y of the detonation center
 * @param radius - Blast radius from grenade definition
 */
export function spawnFragExplosion(x: number, y: number, radius: number) {
    const features = getGraphicsConfig().features;
    ensureBanks();
    spawnRings(x, y, radius);
    spawnEmissiveDebris(x, y, radius);
    spawnDarkDebris(x, y, radius);
    if (features.scorchDecals) spawnScorch(x, y, radius);
    spawnFragLights(x, y);
    spawnFragDisplacement(x, y, radius);
    spawnFragShake(x, y, radius);
}

/**
 * Destroys all active frag visual state: rings, scorches, and all three
 * particle banks. Called on round reset or renderer teardown.
 */
export function clearFragEffects() {
    for (const ring of activeRings) ring.g.destroy();
    activeRings.length = 0;
    for (const scorch of activeScorches) scorch.g.destroy();
    activeScorches.length = 0;
    if (emissiveBank) clearBank(emissiveBank);
    if (darkDebrisBank) clearBank(darkDebrisBank);
    if (secondarySparkBank) clearBank(secondarySparkBank);
}

/**
 * Queues 3-5 staggered ring spawns. Ring count is randomized within
 * [ringCountMin, ringCountMax], with each ring delayed by ringStaggerMs.
 */
function spawnRings(x: number, y: number, radius: number) {
    const count = vfx.ringCountMin + Math.floor(Math.random() * (vfx.ringCountMax - vfx.ringCountMin + 1));
    for (let i = 0; i < count; i++) {
        const delay = i * vfx.ringStaggerMs;
        setTimeout(() => createRing(x, y, radius, i), delay);
    }
}

/**
 * Creates a single expanding shockwave ring graphic and registers a
 * co-located grid displacement source that lives for the ring's duration.
 * Color is cycled from the VFX palette by ring index. Ring starts at
 * ringInitialScale and expands via ease-out cubic.
 *
 * @param x - World X center
 * @param y - World Y center
 * @param radius - Final ring radius
 * @param index - Ring sequence index, used to cycle color
 */
function createRing(x: number, y: number, radius: number, index: number) {
    const duration = vfx.ringDurationMin + Math.random() * (vfx.ringDurationMax - vfx.ringDurationMin);
    const strokeWidth = vfx.ringStrokeWidthMin + Math.random() * vfx.ringStrokeWidthRange;
    const color = vfx.ringColors[index % vfx.ringColors.length];

    const g = new Graphics();
    g.circle(0, 0, radius).stroke({ color, width: strokeWidth });
    g.x = x;
    g.y = y;
    g.scale.set(vfx.ringInitialScale);
    g.alpha = 1;
    g.blendMode = vfx.ringBlendMode as any;
    explosionFxLayer.addChild(g);

    // Each ring drives its own displacement at the ring's current radius
    const displacementId = addDisplacementSource({
        x,
        y,
        radius: radius * vfx.ringDisplacementRadiusFrac,
        strength: radius * vfx.ringDisplacementStrengthMultiplier,
        duration: duration,
    });

    activeRings.push({ g, elapsed: 0, duration, radius, x, y, displacementId });
}

/**
 * Spawns 40-60 additive-blended emissive spark particles radiating outward
 * from the detonation center. During per-frame update, each spark may
 * probabilistically emit a secondary streak spark (gated by the
 * secondarySparks feature toggle).
 */
function spawnEmissiveDebris(x: number, y: number, _radius: number) {
    if (!emissiveBank) return;
    const count = effectsConfig.frag.emissiveCountMin + Math.floor(Math.random() * (effectsConfig.frag.emissiveCountMax - effectsConfig.frag.emissiveCountMin + 1));
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
 * Spawns 15-25 non-emissive dark debris shard particles that simulate
 * heavy chunks flung outward. Subject to gravity via darkDebrisGravity
 * during per-frame update.
 */
function spawnDarkDebris(x: number, y: number, _radius: number) {
    if (!darkDebrisBank) return;
    const count = effectsConfig.frag.darkDebrisCountMin + Math.floor(Math.random() * (effectsConfig.frag.darkDebrisCountMax - effectsConfig.frag.darkDebrisCountMin + 1));
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
 * Draws a three-ring scorch decal on the ground at the blast center.
 * Inner and middle rings share scorchColor; outer ring covers the full
 * blast radius. Fades over scorchFadeDuration.
 */
function spawnScorch(x: number, y: number, radius: number) {
    const g = new Graphics();
    g.circle(0, 0, radius * vfx.scorchInnerRadiusFrac).fill({ color: vfx.scorchColor, alpha: vfx.scorchInnerAlpha });
    g.circle(0, 0, radius * vfx.scorchMiddleRadiusFrac).fill({ color: vfx.scorchColor, alpha: vfx.scorchMiddleAlpha });
    g.circle(0, 0, radius).fill({ color: vfx.scorchColor, alpha: vfx.scorchOuterAlpha });
    g.x = x;
    g.y = y;
    scorchLayer.addChild(g);
    activeScorches.push({ g, elapsed: 0 });
}

/**
 * Adds two-phase transient lighting: an initial bright spike with shadow
 * casting, followed by a delayed secondary glow also with shadows.
 */
function spawnFragLights(x: number, y: number) {
    const l1 = vfx.lightPhase1;
    addTransientLight(x, y, l1.radius, l1.color, l1.intensity, l1.decay, true);
    const l2 = vfx.lightPhase2;
    setTimeout(() => {
        addTransientLight(x, y, l2.radius, l2.color, l2.intensity, l2.decay, true);
    }, l2.delay ?? 0);
}

/**
 * Registers two sequential grid displacement sources: an outward blast
 * wave followed by an inward vacuum pull after a configurable delay.
 */
function spawnFragDisplacement(x: number, y: number, radius: number) {
    addDisplacementSource({
        x,
        y,
        radius: radius * vfx.blast.radiusMultiplier,
        strength: radius * vfx.blast.strengthMultiplier,
        duration: vfx.blast.duration,
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
}

/**
 * Applies distance-attenuated camera shake to the active player. Shake
 * amplitude falls off linearly from vfx.shakeAmplitude at the blast
 * center to zero at radius * vfx.shakeRangeFactor.
 */
function spawnFragShake(x: number, y: number, radius: number) {
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
 * Per-frame ticker callback. Updates all active frag sub-effects:
 * - Rings: ease-out cubic scale expansion + linear alpha fade
 * - Scorches: linear alpha fade over scorchFadeDuration
 * - Emissive sparks: drag-decayed velocity + linear alpha fade + rotation,
 *   with probabilistic secondary spark emission (gated by feature toggle
 *   and frame interval)
 * - Dark debris: drag + gravity + linear alpha fade + rotation
 * - Secondary sparks: linear motion + alpha fade + scale decay
 */
Ticker.shared.add((ticker) => {
    const dt = ticker.deltaMS;
    frameCounter++;

    for (let i = activeRings.length - 1; i >= 0; i--) {
        const ring = activeRings[i];
        ring.elapsed += dt;
        const t = Math.min(1, ring.elapsed / ring.duration);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
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
        const t = Math.min(1, scorch.elapsed / effectsConfig.frag.scorchFadeDuration);
        scorch.g.alpha = 1 - t;
        if (t >= 1) {
            scorch.g.destroy();
            swapRemove(activeScorches, i);
        }
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

            if (getGraphicsConfig().features.secondarySparks && secondarySparkBank && frameCounter % effectsConfig.frag.secondarySparkInterval === 0 && Math.random() < effectsConfig.frag.secondarySparkChance) {
                const si = acquireParticle(secondarySparkBank);
                if (si !== -1) {
                    secondarySparkBank.x[si] = bank.x[idx];
                    secondarySparkBank.y[si] = bank.y[idx];
                    secondarySparkBank.vx[si] = (Math.random() - 0.5) * 2;
                    secondarySparkBank.vy[si] = (Math.random() - 0.5) * 2;
                    secondarySparkBank.scale[si] = vfx.secondarySparkScaleMin + Math.random() * vfx.secondarySparkScaleRange;
                    secondarySparkBank.rotation[si] = Math.random() * Math.PI * 2;
                    secondarySparkBank.alpha[si] = vfx.secondarySparkInitialAlpha;
                    secondarySparkBank.duration[si] = vfx.secondarySparkDurationMin + Math.random() * vfx.secondarySparkDurationRange;
                    secondarySparkBank.sprites[si].tint = vfx.secondarySparkTint;
                }
            }
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

    if (secondarySparkBank) {
        updateBank(secondarySparkBank, dt, (bank, idx) => {
            const t = bank.elapsed[idx] / bank.duration[idx];
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = vfx.secondarySparkInitialAlpha * (1 - t);
            bank.scale[idx] *= vfx.secondarySparkDecay;
            return true;
        });
    }
});
