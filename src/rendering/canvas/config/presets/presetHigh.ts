import type { GraphicsConfig } from '../graphicsConfig';

export const PRESET_HIGH: GraphicsConfig = {
    resolution: window.devicePixelRatio * 2,
    antialias: true,
    lightmapScale: 0.5,

    features: {
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
        textureSize: 64,
        largeSoftCircleSize: 128,
        hardDotSize: 16,
        shardSize: 24,
        streakWidth: 32,
        streakHeight: 6,
    },

    glow: {
        distance: 8,
        quality: 0.3,
        filterResolution: 2,
    },

    grid: {
        spacing: 42,
        dotBaseAlpha: 0.1,
        dotDisplaceAlpha: 0.6,
        dotBaseRadius: 1.0,
        dotDisplaceRadius: 1.2,
        lineAlpha: 0.05,
        lineWidth: 1,
    },

    pools: {
        projectileInitial: 64,
        projectileMax: 512,
    },

    deathEffect: {
        shardCount: 28,
        sparkCount: 16,
    },

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
        layerCount: 3,
    },
};
