import type { GraphicsConfig } from '../graphicsConfig';

export const PRESET_LOW: GraphicsConfig = {
    resolution: Math.min(window.devicePixelRatio, 1),
    antialias: false,
    lightmapScale: 0.25,

    features: {
        gridDisplacement: false,
        glowFilter: false,
        heatShimmer: false,
        screenDesaturation: false,
        secondarySparks: false,
        scorchDecals: false,
        smokeLightSampling: false,
        smokeVolumeLayers: false,
    },

    particles: {
        textureSize: 32,
        largeSoftCircleSize: 64,
        hardDotSize: 8,
        shardSize: 16,
        streakWidth: 16,
        streakHeight: 4,
    },

    glow: {
        distance: 4,
        quality: 0.15,
        filterResolution: 1,
    },

    grid: {
        spacing: 42,
        dotBaseAlpha: 0.08,
        dotDisplaceAlpha: 0.4,
        dotBaseRadius: 1.0,
        dotDisplaceRadius: 1.0,
        lineAlpha: 0.04,
        lineWidth: 1,
    },

    pools: {
        projectileInitial: 32,
        projectileMax: 256,
    },

    deathEffect: {
        shardCount: 14,
        sparkCount: 8,
    },

    frag: {
        emissiveCountMin: 15,
        emissiveCountMax: 25,
        darkDebrisCountMin: 6,
        darkDebrisCountMax: 12,
        emissiveBankCapacity: 128,
        darkDebrisBankCapacity: 64,
        secondarySparkBankCapacity: 0,
        secondarySparkChance: 0,
        secondarySparkInterval: 3,
        scorchFadeDuration: 4000,
    },

    c4: {
        emissiveCountMin: 30,
        emissiveCountMax: 50,
        darkDebrisCountMin: 15,
        darkDebrisCountMax: 25,
        dustCountMin: 10,
        dustCountMax: 15,
        emissiveBankCapacity: 128,
        darkDebrisBankCapacity: 64,
        dustBankCapacity: 32,
        scorchFadeDuration: 5000,
        shimmerTextureSize: 64,
        shimmerFilterScale: 10,
        shimmerDuration: 1500,
        desatDuration: 1000,
        desatRange: 400,
        desatAlpha: 0.6,
    },

    flash: {
        gradientTextureSize: 64,
    },

    smoke: {
        emitCountMin: 20,
        emitCountMax: 30,
        bankCapacity: 128,
        lightSampleInterval: 6,
        layerCount: 1,
    },
};
