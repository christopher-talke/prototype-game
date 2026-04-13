import type { GlowQuality } from './graphicsConfig';

// Quality-managed fields (distance, quality, filterResolution) are written by
// applyGraphicsConfig().  Design fields below are preset-independent.
export const glowConfig = {
    distance: 8,
    quality: 0.3,
    filterResolution: 2,
    normalStrength: 1.0,
    spikeBase: 2.5,
    spikeDamageScale: 2.5,
    spikeDecayMs: 300,
    deathDrainMs: 400,
    respawnFadeMs: 500,
    lowHpThreshold: 50,
    criticalHpThreshold: 25,
    pulseFreqHz: 2,
};

type AssertExtends<_T extends _Q, _Q> = true;
export type _GlowOk = AssertExtends<typeof glowConfig, GlowQuality>;
