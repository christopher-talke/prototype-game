/**
 * Master graphics quality configuration.
 *
 * `GraphicsConfig` is the single authoritative type for all rendering quality
 * parameters. Per-domain config objects (effectsConfig, glowConfig, etc.)
 * remain the runtime access points; {@link applyGraphicsConfig} pushes values
 * into them so consuming modules need zero import changes.
 *
 * Quality sub-interfaces are referenced by per-domain config types via
 * compile-time `AssertExtends` checks. Adding a field to a sub-interface
 * without updating the domain config or the presets is a compiler error.
 * `applyGraphicsConfig` uses per-section `Object.assign`, so new fields
 * within an existing section are covered automatically.
 */

import { effectsConfig } from './effectsConfig';
import { glowConfig } from './glowConfig';
import { gridConfig } from './gridConfig';
import { particleConfig } from './particleConfig';
import { setLightmapScale } from '../renderConstants';
import { PRESET_LOW, PRESET_MEDIUM, PRESET_HIGH, PRESET_ULTRA } from './presets';

/** Identifier for one of the four built-in quality levels. */
export type QualityPreset = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

/** Quality-managed fields for frag grenade effects. Consumed by effectsConfig. */
export interface FragQuality {
    emissiveCountMin: number;
    emissiveCountMax: number;
    darkDebrisCountMin: number;
    darkDebrisCountMax: number;
    emissiveBankCapacity: number;
    darkDebrisBankCapacity: number;
    secondarySparkBankCapacity: number;
    secondarySparkChance: number;
    secondarySparkInterval: number;
    scorchFadeDuration: number;
}

/** Quality-managed fields for C4 grenade effects. Consumed by effectsConfig. */
export interface C4Quality {
    emissiveCountMin: number;
    emissiveCountMax: number;
    darkDebrisCountMin: number;
    darkDebrisCountMax: number;
    dustCountMin: number;
    dustCountMax: number;
    emissiveBankCapacity: number;
    darkDebrisBankCapacity: number;
    dustBankCapacity: number;
    scorchFadeDuration: number;
    shimmerTextureSize: number;
    shimmerFilterScale: number;
    shimmerDuration: number;
    desatDuration: number;
    desatRange: number;
    desatAlpha: number;
}

/** Quality-managed fields for flash grenade effects. Consumed by effectsConfig. */
export interface FlashQuality {
    gradientTextureSize: number;
}

/** Quality-managed fields for smoke grenade effects. Consumed by effectsConfig. */
export interface SmokeQuality {
    emitCountMin: number;
    emitCountMax: number;
    bankCapacity: number;
    lightSampleInterval: number;
    layerCount: 1 | 3;
}

/** Quality-managed fields for the player glow filter. Consumed by glowConfig. */
export interface GlowQuality {
    distance: number;
    quality: number;
    filterResolution: number;
}

/** Quality-managed fields for the background displacement grid. Consumed by gridConfig. */
export interface GridQuality {
    spacing: number;
    dotBaseAlpha: number;
    dotDisplaceAlpha: number;
    dotBaseRadius: number;
    dotDisplaceRadius: number;
    lineAlpha: number;
    lineWidth: number;
}

/** Quality-managed fields for particle texture atlas generation. Consumed by particleConfig. */
export interface ParticleQuality {
    textureSize: number;
    largeSoftCircleSize: number;
    hardDotSize: number;
    shardSize: number;
    streakWidth: number;
    streakHeight: number;
}

/**
 * Complete set of rendering quality parameters for one preset level.
 * Feature toggles in `features` guard expensive rendering paths at call sites.
 */
export interface GraphicsConfig {
    resolution: number;
    antialias: boolean;
    lightmapScale: number;

    features: {
        dynamicLighting: boolean;
        gridDisplacement: boolean;
        glowFilter: boolean;
        heatShimmer: boolean;
        screenDesaturation: boolean;
        secondarySparks: boolean;
        scorchDecals: boolean;
        smokeLightSampling: boolean;
        smokeVolumeLayers: boolean;
    };

    particles: ParticleQuality;
    glow: GlowQuality;
    grid: GridQuality;

    pools: {
        projectileInitial: number;
        projectileMax: number;
    };

    deathEffect: {
        shardCount: number;
        sparkCount: number;
    };

    frag: FragQuality;
    c4: C4Quality;
    flash: FlashQuality;
    smoke: SmokeQuality;
}

export { PRESET_LOW, PRESET_MEDIUM, PRESET_HIGH, PRESET_ULTRA };

/** Lookup from preset name to its full config object. */
export const GRAPHICS_PRESETS: Record<QualityPreset, GraphicsConfig> = {
    LOW: PRESET_LOW,
    MEDIUM: PRESET_MEDIUM,
    HIGH: PRESET_HIGH,
    ULTRA: PRESET_ULTRA,
};

let activeConfig: GraphicsConfig = { ...PRESET_HIGH };
let activePreset: QualityPreset = 'HIGH';

/** Returns the currently active graphics config (read-only). */
export function getGraphicsConfig(): Readonly<GraphicsConfig> {
    return activeConfig;
}

/** Returns the name of the currently active quality preset. */
export function getGraphicsPreset(): QualityPreset {
    return activePreset;
}

/**
 * Applies a quality preset by copying its values into the per-domain config
 * objects (effectsConfig, glowConfig, gridConfig, particleConfig) and updating
 * the lightmap scale.
 * @param preset - The quality level to apply.
 * @param config - Optional full config override; defaults to the built-in preset.
 */
export function applyGraphicsConfig(preset: QualityPreset, config: GraphicsConfig = GRAPHICS_PRESETS[preset]): void {
    activePreset = preset;
    activeConfig = config;

    Object.assign(effectsConfig.frag, config.frag);
    Object.assign(effectsConfig.c4, config.c4);
    Object.assign(effectsConfig.flash, config.flash);
    Object.assign(effectsConfig.smoke, config.smoke);
    Object.assign(glowConfig, config.glow);
    Object.assign(gridConfig, config.grid);
    Object.assign(particleConfig, config.particles);

    setLightmapScale(config.lightmapScale);
}
