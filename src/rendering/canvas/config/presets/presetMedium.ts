import type { GraphicsConfig } from '../graphicsConfig';

export const PRESET_MEDIUM: GraphicsConfig = {
    resolution: window.Math.min(window.devicePixelRatio, 1.5),
    antialias: false,
    lightmapScale: 0.35,

    features: {
        gridDisplacement: true,
        glowFilter: false,
        heatShimmer: false,
        screenDesaturation: true,
        secondarySparks: false,
        scorchDecals: true,
        smokeLightSampling: false,
        smokeVolumeLayers: false,
    },

    particles: {
        textureSize: 48,
        largeSoftCircleSize: 96,
        hardDotSize: 12,
        shardSize: 20,
        streakWidth: 24,
        streakHeight: 5,
    },

    glow: {
        distance: 6,
        quality: 0.2,
        filterResolution: 1,
    },

    grid: {
        spacing: 42,
        dotBaseAlpha: 0.1,
        dotDisplaceAlpha: 0.5,
        dotBaseRadius: 1.0,
        dotDisplaceRadius: 1.1,
        lineAlpha: 0.05,
        lineWidth: 1,
    },

    pools: {
        projectileInitial: 48,
        projectileMax: 384,
    },

    deathEffect: {
        shardCount: 20,
        sparkCount: 12,
    },

    frag: {
        emissiveCountMin: 25,
        emissiveCountMax: 40,
        darkDebrisCountMin: 10,
        darkDebrisCountMax: 18,
        emissiveBankCapacity: 192,
        darkDebrisBankCapacity: 96,
        secondarySparkBankCapacity: 64,
        secondarySparkChance: 0.1,
        secondarySparkInterval: 4,
        scorchFadeDuration: 6000,
    },

    c4: {
        emissiveCountMin: 50,
        emissiveCountMax: 80,
        darkDebrisCountMin: 25,
        darkDebrisCountMax: 40,
        dustCountMin: 20,
        dustCountMax: 28,
        emissiveBankCapacity: 192,
        darkDebrisBankCapacity: 96,
        dustBankCapacity: 48,
        scorchFadeDuration: 7000,
        shimmerTextureSize: 96,
        shimmerFilterScale: 12,
        shimmerDuration: 2000,
        desatDuration: 1200,
        desatRange: 500,
        desatAlpha: 0.7,
    },

    flash: {
        gradientTextureSize: 128,
    },

    smoke: {
        emitCountMin: 30,
        emitCountMax: 40,
        bankCapacity: 192,
        lightSampleInterval: 5,
        layerCount: 1,
    },
};
