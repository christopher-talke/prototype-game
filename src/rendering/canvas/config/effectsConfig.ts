import type { FragQuality, C4Quality, FlashQuality, SmokeQuality } from './graphicsConfig';

/**
 * Quality-managed particle counts, bank capacities, and effect parameters
 * for grenade visual effects. Values are overwritten by {@link applyGraphicsConfig}
 * when a preset is applied; defaults here match the HIGH preset.
 */
export const effectsConfig = {
    frag: {
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

type AssertExtends<_T extends _Q, _Q> = true;
export type _FragOk = AssertExtends<typeof effectsConfig.frag, FragQuality>;
export type _C4Ok = AssertExtends<typeof effectsConfig.c4, C4Quality>;
export type _FlashOk = AssertExtends<typeof effectsConfig.flash, FlashQuality>;
export type _SmokeOk = AssertExtends<typeof effectsConfig.smoke, SmokeQuality>;
