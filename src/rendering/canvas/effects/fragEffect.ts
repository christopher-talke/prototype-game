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

const vfx = GRENADE_VFX.FRAG.explosion;

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
    emissiveBank = createParticleBank(effectsConfig.frag.emissiveBankCapacity, texHardDot, sparkLayer, 'add');
    darkDebrisBank = createParticleBank(effectsConfig.frag.darkDebrisBankCapacity, texShard, debrisLayer);
    secondarySparkBank = createParticleBank(effectsConfig.frag.secondarySparkBankCapacity, texStreak, sparkLayer, 'add');
}

// --- Public API ---

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
    const count = vfx.ringCountMin + Math.floor(Math.random() * (vfx.ringCountMax - vfx.ringCountMin + 1));
    for (let i = 0; i < count; i++) {
        const delay = i * vfx.ringStaggerMs;
        setTimeout(() => createRing(x, y, radius, i), delay);
    }
}

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

// --- Emissive debris (sparks) ---

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

// --- Dark debris (non-emissive chunks) ---

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

// --- Scorch decal ---

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

// --- Lighting ---

function spawnFragLights(x: number, y: number) {
    const l1 = vfx.lightPhase1;
    addTransientLight(x, y, l1.radius, l1.color, l1.intensity, l1.decay, true);
    const l2 = vfx.lightPhase2;
    setTimeout(() => {
        addTransientLight(x, y, l2.radius, l2.color, l2.intensity, l2.decay, true);
    }, l2.delay ?? 0);
}

// --- Grid displacement ---

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

// --- Camera shake ---

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
        ring.g.scale.set(vfx.ringInitialScale + (1 - vfx.ringInitialScale) * eased);
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
        const t = Math.min(1, scorch.elapsed / effectsConfig.frag.scorchFadeDuration);
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

    // Update secondary sparks
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
