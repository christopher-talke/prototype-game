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
    const count = effectsConfig.frag.ringCountMin + Math.floor(Math.random() * (effectsConfig.frag.ringCountMax - effectsConfig.frag.ringCountMin + 1));
    for (let i = 0; i < count; i++) {
        const delay = i * effectsConfig.frag.ringStaggerMs;
        setTimeout(() => createRing(x, y, radius, i), delay);
    }
}

function createRing(x: number, y: number, radius: number, index: number) {
    const duration = effectsConfig.frag.ringDurationMin + Math.random() * (effectsConfig.frag.ringDurationMax - effectsConfig.frag.ringDurationMin);
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
        x,
        y,
        radius: radius * effectsConfig.frag.ringDisplacementRadiusFrac,
        strength: radius * effectsConfig.frag.ringDisplacementStrengthMultiplier,
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
        const speed = effectsConfig.frag.emissiveSpeedMin + Math.random() * effectsConfig.frag.emissiveSpeedRange;
        emissiveBank.x[idx] = x;
        emissiveBank.y[idx] = y;
        emissiveBank.vx[idx] = Math.cos(angle) * speed;
        emissiveBank.vy[idx] = Math.sin(angle) * speed;
        emissiveBank.scale[idx] = effectsConfig.frag.emissiveScaleMin + Math.random() * effectsConfig.frag.emissiveScaleRange;
        emissiveBank.rotation[idx] = Math.random() * Math.PI * 2;
        emissiveBank.alpha[idx] = 1;
        emissiveBank.duration[idx] = effectsConfig.frag.emissiveDurationMin + Math.random() * effectsConfig.frag.emissiveDurationRange;

        // Tint: orange-yellow-white gradient
        const tints = [0xffaa33, 0xffcc44, 0xffdd66, 0xffeebb, 0xffffff];
        emissiveBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
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
        const speed = effectsConfig.frag.darkDebrisSpeedMin + Math.random() * effectsConfig.frag.darkDebrisSpeedRange;
        darkDebrisBank.x[idx] = x;
        darkDebrisBank.y[idx] = y;
        darkDebrisBank.vx[idx] = Math.cos(angle) * speed;
        darkDebrisBank.vy[idx] = Math.sin(angle) * speed;
        darkDebrisBank.scale[idx] = effectsConfig.frag.darkDebrisScaleMin + Math.random() * effectsConfig.frag.darkDebrisScaleRange;
        darkDebrisBank.rotation[idx] = Math.random() * Math.PI * 2;
        darkDebrisBank.alpha[idx] = 0.9;
        darkDebrisBank.duration[idx] = effectsConfig.frag.darkDebrisDurationMin + Math.random() * effectsConfig.frag.darkDebrisDurationRange;

        // Gray-brown tints
        const tints = [0x665544, 0x776655, 0x554433, 0x887766];
        darkDebrisBank.sprites[idx].tint = tints[Math.floor(Math.random() * tints.length)];
    }
}

// --- Scorch decal ---

function spawnScorch(x: number, y: number, radius: number) {
    const g = new Graphics();
    // Dark center fading to transparent
    g.circle(0, 0, radius * effectsConfig.frag.scorchInnerRadiusFrac).fill({ color: 0x111111, alpha: effectsConfig.frag.scorchInnerAlpha });
    g.circle(0, 0, radius * effectsConfig.frag.scorchMiddleRadiusFrac).fill({ color: 0x111111, alpha: effectsConfig.frag.scorchMiddleAlpha });
    g.circle(0, 0, radius).fill({ color: 0x111111, alpha: effectsConfig.frag.scorchOuterAlpha });
    g.x = x;
    g.y = y;
    scorchLayer.addChild(g);
    activeScorches.push({ g, elapsed: 0 });
}

// --- Lighting ---

function spawnFragLights(x: number, y: number) {
    addTransientLight(x, y, effectsConfig.frag.lightPhase1Radius, 0xffcc66, effectsConfig.frag.lightPhase1Intensity, effectsConfig.frag.lightPhase1Decay, true);
    setTimeout(() => {
        addTransientLight(x, y, effectsConfig.frag.lightPhase2Radius, 0xff6622, effectsConfig.frag.lightPhase2Intensity, effectsConfig.frag.lightPhase2Decay, true);
    }, effectsConfig.frag.lightPhase2Delay);
}

// --- Grid displacement ---

function spawnFragDisplacement(x: number, y: number, radius: number) {
    addDisplacementSource({
        x,
        y,
        radius: radius * effectsConfig.frag.blastRadiusMultiplier,
        strength: radius * effectsConfig.frag.blastStrengthMultiplier,
        duration: effectsConfig.frag.blastDuration,
    });
    setTimeout(() => {
        addDisplacementSource({
            x,
            y,
            radius: radius * effectsConfig.frag.vacuumRadiusMultiplier,
            strength: radius * effectsConfig.frag.vacuumStrengthMultiplier,
            duration: effectsConfig.frag.vacuumDuration,
        });
    }, effectsConfig.frag.vacuumDelay);
}

// --- Camera shake ---

function spawnFragShake(x: number, y: number, radius: number) {
    if (ACTIVE_PLAYER == null) return;
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) return;
    const px = p.current_position.x + HALF_HIT_BOX;
    const py = p.current_position.y + HALF_HIT_BOX;
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    const maxRange = radius * effectsConfig.frag.shakeRangeFactor;
    if (dist >= maxRange) return;
    const falloff = 1 - dist / maxRange;
    addCameraShake(effectsConfig.frag.shakeAmplitude * falloff, effectsConfig.frag.shakeDuration);
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
            bank.vx[idx] *= effectsConfig.frag.emissiveDrag;
            bank.vy[idx] *= effectsConfig.frag.emissiveDrag;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = 1 - t;
            bank.rotation[idx] += effectsConfig.frag.emissiveRotationSpeed;

            if (getGraphicsConfig().features.secondarySparks && secondarySparkBank && frameCounter % effectsConfig.frag.secondarySparkInterval === 0 && Math.random() < effectsConfig.frag.secondarySparkChance) {
                const si = acquireParticle(secondarySparkBank);
                if (si !== -1) {
                    secondarySparkBank.x[si] = bank.x[idx];
                    secondarySparkBank.y[si] = bank.y[idx];
                    secondarySparkBank.vx[si] = (Math.random() - 0.5) * 2;
                    secondarySparkBank.vy[si] = (Math.random() - 0.5) * 2;
                    secondarySparkBank.scale[si] = effectsConfig.frag.secondarySparkScaleMin + Math.random() * effectsConfig.frag.secondarySparkScaleRange;
                    secondarySparkBank.rotation[si] = Math.random() * Math.PI * 2;
                    secondarySparkBank.alpha[si] = 0.8;
                    secondarySparkBank.duration[si] = effectsConfig.frag.secondarySparkDurationMin + Math.random() * effectsConfig.frag.secondarySparkDurationRange;
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
            bank.vx[idx] *= effectsConfig.frag.darkDebrisDrag;
            bank.vy[idx] = bank.vy[idx] * effectsConfig.frag.darkDebrisDrag + effectsConfig.frag.darkDebrisGravity;
            bank.x[idx] += bank.vx[idx];
            bank.y[idx] += bank.vy[idx];
            bank.alpha[idx] = 0.9 * (1 - t);
            bank.rotation[idx] += effectsConfig.frag.darkDebrisRotationSpeed;
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
            bank.scale[idx] *= effectsConfig.frag.secondarySparkDecay;
            return true;
        });
    }
});
