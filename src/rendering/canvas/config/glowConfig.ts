import type { GlowQuality } from './graphicsConfig';

/**
 * Player glow filter configuration. Quality-managed fields (distance, quality,
 * filterResolution) are overwritten by {@link applyGraphicsConfig}; remaining
 * fields are preset-independent design constants controlling glow animation.
 */
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
