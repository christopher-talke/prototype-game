// ---------------------------------------------------------------------------
// Graphics quality configuration
// ---------------------------------------------------------------------------
// GraphicsConfig is the single authoritative type for all rendering quality parameters.  
// Per-domain config objects (effectsConfig, glowConfig, etc.)
// remain the runtime access points; applyGraphicsConfig() pushes values into
// them so that consuming modules need zero import changes.
//
// Maintainability contract:
//   - Quality sub-interfaces are referenced by per-domain config types.
//     Adding a field here without updating the per-domain config or the
//     presets is a compiler error.
//   - applyGraphicsConfig() uses per-section Object.assign, so new fields
//     within an existing section are covered automatically.
// ---------------------------------------------------------------------------

export type QualityPreset = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

// --- Quality sub-interfaces (exported for per-domain config typing) --------
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

export interface FlashQuality {
    gradientTextureSize: number;
}

export interface SmokeQuality {
    emitCountMin: number;
    emitCountMax: number;
    bankCapacity: number;
    lightSampleInterval: number;
    layerCount: 1 | 3;
}

export interface GlowQuality {
    distance: number;
    quality: number;
    filterResolution: number;
}

export interface GridQuality {
    spacing: number;
    dotBaseAlpha: number;
    dotDisplaceAlpha: number;
    dotBaseRadius: number;
    dotDisplaceRadius: number;
    lineAlpha: number;
    lineWidth: number;
}

export interface ParticleQuality {
    textureSize: number;
    largeSoftCircleSize: number;
    hardDotSize: number;
    shardSize: number;
    streakWidth: number;
    streakHeight: number;
}

// --- Main config interface -------------------------------------------------
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

// --- Presets (defined in config/presets/) -----------------------------------
import { PRESET_LOW, PRESET_MEDIUM, PRESET_HIGH, PRESET_ULTRA } from './presets';
export { PRESET_LOW, PRESET_MEDIUM, PRESET_HIGH, PRESET_ULTRA };

export const GRAPHICS_PRESETS: Record<QualityPreset, GraphicsConfig> = {
    LOW: PRESET_LOW,
    MEDIUM: PRESET_MEDIUM,
    HIGH: PRESET_HIGH,
    ULTRA: PRESET_ULTRA,
};

// --- Runtime state ---------------------------------------------------------
let activeConfig: GraphicsConfig = { ...PRESET_HIGH };
let activePreset: QualityPreset = 'HIGH';

export function getGraphicsConfig(): Readonly<GraphicsConfig> {
    return activeConfig;
}

export function getGraphicsPreset(): QualityPreset {
    return activePreset;
}

// --- Apply -----------------------------------------------------------------
import { effectsConfig } from './effectsConfig';
import { glowConfig } from './glowConfig';
import { gridConfig } from './gridConfig';
import { particleConfig } from './particleConfig';
import { setLightmapScale } from '../renderConstants';

export function applyGraphicsConfig(preset: QualityPreset, config: GraphicsConfig = GRAPHICS_PRESETS[preset]): void {
    activePreset = preset;
    activeConfig = config;

    // Push quality values into per-domain configs
    Object.assign(effectsConfig.frag, config.frag);
    Object.assign(effectsConfig.c4, config.c4);
    Object.assign(effectsConfig.flash, config.flash);
    Object.assign(effectsConfig.smoke, config.smoke);
    Object.assign(glowConfig, config.glow);
    Object.assign(gridConfig, config.grid);
    Object.assign(particleConfig, config.particles);

    // Lightmap scale lives in renderConstants (used by lightingManager)
    setLightmapScale(config.lightmapScale);
}
