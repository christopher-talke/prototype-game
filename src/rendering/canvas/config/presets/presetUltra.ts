import type { GraphicsConfig } from '../graphicsConfig';

export const PRESET_ULTRA: GraphicsConfig = {
    resolution: window.devicePixelRatio,
    antialias: true,
    lightmapScale: 1,

    features: {
        dynamicLighting: true,
        gridDisplacement: true,
        glowFilter: true,
        heatShimmer: true,
        screenDesaturation: true,
        secondarySparks: true,
        scorchDecals: true,
        smokeLightSampling: true,
        smokeVolumeLayers: true,
    },

    particles: {
        textureSize: 128,
        largeSoftCircleSize: 256,
        hardDotSize: 32,
        shardSize: 32,
        streakWidth: 48,
        streakHeight: 8,
    },

    glow: {
        distance: 12,
        quality: 0.5,
        filterResolution: 2,
    },

    grid: {
        spacing: 42,
        dotBaseAlpha: 0.12,
        dotDisplaceAlpha: 0.7,
        dotBaseRadius: 1.0,
        dotDisplaceRadius: 1.4,
        lineAlpha: 0.06,
        lineWidth: 1,
    },

    pools: {
        projectileInitial: 96,
        projectileMax: 768,
    },

    deathEffect: {
        shardCount: 36,
        sparkCount: 24,
    },

    frag: {
        emissiveCountMin: 55,
        emissiveCountMax: 80,
        darkDebrisCountMin: 20,
        darkDebrisCountMax: 35,
        emissiveBankCapacity: 384,
        darkDebrisBankCapacity: 192,
        secondarySparkBankCapacity: 192,
        secondarySparkChance: 0.2,
        secondarySparkInterval: 2,
        scorchFadeDuration: 12000,
    },

    c4: {
        emissiveCountMin: 110,
        emissiveCountMax: 160,
        darkDebrisCountMin: 55,
        darkDebrisCountMax: 80,
        dustCountMin: 40,
        dustCountMax: 55,
        emissiveBankCapacity: 384,
        darkDebrisBankCapacity: 192,
        dustBankCapacity: 96,
        scorchFadeDuration: 15000,
        shimmerTextureSize: 192,
        shimmerFilterScale: 20,
        shimmerDuration: 3000,
        desatDuration: 1800,
        desatRange: 700,
        desatAlpha: 0.9,
    },

    flash: {
        gradientTextureSize: 512,
    },

    smoke: {
        emitCountMin: 55,
        emitCountMax: 75,
        bankCapacity: 384,
        lightSampleInterval: 2,
        layerCount: 3,
    },
};
