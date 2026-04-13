import type { FragQuality, C4Quality, FlashQuality, SmokeQuality } from './graphicsConfig';

export const effectsConfig = {
    frag: {
        // Quality-managed particle counts and capacities
        emissiveCountMin: 40,
        emissiveCountMax: 60,
        darkDebrisCountMin: 15,
        darkDebrisCountMax: 25,
        emissiveBankCapacity: 256,
        darkDebrisBankCapacity: 128,
        secondarySparkBankCapacity: 128,
        secondarySparkChance: 0.15,
        secondarySparkInterval: 3,
        scorchFadeDuration: 8000,
    },
    c4: {
        // Quality-managed particle counts, capacities, and effect params
        emissiveCountMin: 80,
        emissiveCountMax: 120,
        darkDebrisCountMin: 40,
        darkDebrisCountMax: 60,
        dustCountMin: 30,
        dustCountMax: 40,
        emissiveBankCapacity: 256,
        darkDebrisBankCapacity: 128,
        dustBankCapacity: 64,
        scorchFadeDuration: 10000,
        shimmerTextureSize: 128,
        shimmerFilterScale: 15,
        shimmerDuration: 2500,
        desatDuration: 1500,
        desatRange: 600,
        desatAlpha: 0.8,
    },
    flash: {
        gradientTextureSize: 256,
    },
    smoke: {
        emitCountMin: 40,
        emitCountMax: 55,
        bankCapacity: 256,
        lightSampleInterval: 3,
        layerCount: 3 as 1 | 3,
    },
};

// Compile-time enforcement: each section must include all quality-managed fields.
// If a field is added to a quality sub-interface but missing here, this errors.
type AssertExtends<_T extends _Q, _Q> = true;
export type _FragOk = AssertExtends<typeof effectsConfig.frag, FragQuality>;
export type _C4Ok = AssertExtends<typeof effectsConfig.c4, C4Quality>;
export type _FlashOk = AssertExtends<typeof effectsConfig.flash, FlashQuality>;
export type _SmokeOk = AssertExtends<typeof effectsConfig.smoke, SmokeQuality>;
