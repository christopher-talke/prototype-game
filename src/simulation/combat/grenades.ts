import { getConfig } from '@config/activeConfig';

export const GRENADE_DEFS: Record<GrenadeType, GrenadeDef> = {
    FRAG: {
        id: 'FRAG',
        name: 'Frag Grenade',
        price: 300,
        throwSpeed: 30,
        fuseTime: 2000,
        radius: 150,
        damage: 100,
        effectDuration: 0,
        shrapnelCount: 30,
        shrapnelDamage: 40,
        shrapnelSpeed: 20,
    },
    FLASH: {
        id: 'FLASH',
        name: 'Flashbang',
        price: 200,
        throwSpeed: 35,
        fuseTime: 1500,
        radius: 600,
        damage: 0,
        effectDuration: 3000,
    },
    SMOKE: {
        id: 'SMOKE',
        name: 'Smoke Grenade',
        price: 300,
        throwSpeed: 28,
        fuseTime: 1500,
        radius: 120,
        damage: 0,
        effectDuration: 22000,
    },
    C4: {
        id: 'C4',
        name: 'C4 Explosive',
        price: 400,
        throwSpeed: 0,
        fuseTime: 0,
        radius: 200,
        damage: 150,
        effectDuration: 0,
        shrapnelCount: 80,
        shrapnelDamage: 60,
        shrapnelSpeed: 20,
    },
};

export function getGrenadeDef(type: GrenadeType): GrenadeDef {
    return GRENADE_DEFS[type];
}

// --- VFX definitions (read only by the rendering layer) ---

export const GRENADE_VFX: GrenadeVfxMap = {
    FRAG: {
        sprite: { color: 0x2ed573, radius: 6, fillAlpha: 0.9, strokeColor: 0xffffff, strokeWidth: 1, strokeAlpha: 0.4 },
        explosion: {
            ringCountMin: 3,
            ringCountMax: 5,
            ringStaggerMs: 35,
            ringDurationMin: 300,
            ringDurationMax: 500,
            ringStrokeWidthMin: 4,
            ringStrokeWidthRange: 3,
            ringColors: [0xff9500, 0xffaa22, 0xff8800, 0xffbb33, 0xff7700],
            ringInitialScale: 0.05,
            ringBlendMode: 'add',
            ringDisplacementRadiusFrac: 0.3,
            ringDisplacementStrengthMultiplier: 12,

            emissiveSpeedMin: 4,
            emissiveSpeedRange: 8,
            emissiveScaleMin: 0.8,
            emissiveScaleRange: 0.6,
            emissiveDurationMin: 400,
            emissiveDurationRange: 400,
            emissiveDrag: 0.94,
            emissiveRotationSpeed: 0.05,
            emissiveTints: [0xffaa33, 0xffcc44, 0xffdd66, 0xffeebb, 0xffffff],
            emissiveBlendMode: 'add',
            emissiveInitialAlpha: 1,

            darkDebrisSpeedMin: 3,
            darkDebrisSpeedRange: 5,
            darkDebrisScaleMin: 0.6,
            darkDebrisScaleRange: 0.8,
            darkDebrisDurationMin: 500,
            darkDebrisDurationRange: 500,
            darkDebrisDrag: 0.92,
            darkDebrisGravity: 0.15,
            darkDebrisRotationSpeed: 0.08,
            darkDebrisTints: [0x665544, 0x776655, 0x554433, 0x887766],
            darkDebrisInitialAlpha: 0.9,

            secondarySparkScaleMin: 0.3,
            secondarySparkScaleRange: 0.3,
            secondarySparkDurationMin: 100,
            secondarySparkDurationRange: 100,
            secondarySparkDecay: 0.97,
            secondarySparkTint: 0xffdd88,
            secondarySparkInitialAlpha: 0.8,

            scorchInnerRadiusFrac: 0.3,
            scorchMiddleRadiusFrac: 0.6,
            scorchInnerAlpha: 0.6,
            scorchMiddleAlpha: 0.3,
            scorchOuterAlpha: 0.1,
            scorchColor: 0x111111,

            lightPhase1: { radius: 500, color: 0xffcc66, intensity: 5.0, decay: 80 },
            lightPhase2: { radius: 400, color: 0xff6622, intensity: 2.5, decay: 220, delay: 80 },

            blast: { radiusMultiplier: 2, strengthMultiplier: 50, duration: 400 },
            vacuum: { delay: 200, radiusMultiplier: 1.5, strengthMultiplier: -15, duration: 300 },

            shakeAmplitude: 16,
            shakeRangeFactor: 5,
            shakeDuration: 400,
        },
    },
    C4: {
        sprite: { color: 0xff4757, radius: 6, fillAlpha: 0.9, strokeColor: 0xffffff, strokeWidth: 1, strokeAlpha: 0.4 },
        explosion: {
            ringCount: 2,
            ringDuration: 700,
            ringDurationRange: 100,
            ringStaggerMs: 80,
            ringRadiusMultiplier: 1.5,
            ringStrokeWidthMin: 6,
            ringStrokeWidthRange: 2,
            ringColors: [0xff4400, 0xff6622],
            ringInitialScale: 0.05,
            ringBlendMode: 'add',

            emissiveSpeedMin: 6,
            emissiveSpeedRange: 10,
            emissiveScaleMin: 1.0,
            emissiveScaleRange: 0.8,
            emissiveDurationMin: 500,
            emissiveDurationRange: 600,
            emissiveDrag: 0.93,
            emissiveRotationSpeed: 0.06,
            emissiveTints: [0xff6622, 0xff8844, 0xffaa55, 0xffcc88, 0xffffff],
            emissiveBlendMode: 'add',
            emissiveInitialAlpha: 1,

            darkDebrisSpeedMin: 3,
            darkDebrisSpeedRange: 6,
            darkDebrisScaleMin: 0.8,
            darkDebrisScaleRange: 1.0,
            darkDebrisDurationMin: 600,
            darkDebrisDurationRange: 600,
            darkDebrisDrag: 0.9,
            darkDebrisGravity: 0.18,
            darkDebrisRotationSpeed: 0.1,
            darkDebrisTints: [0x554433, 0x665544, 0x443322, 0x776655],
            darkDebrisInitialAlpha: 0.9,

            dustSpeedMin: 0.5,
            dustSpeedRange: 1.5,
            dustScaleMin: 0.3,
            dustScaleRange: 0.4,
            dustAlphaMin: 0.2,
            dustAlphaRange: 0.2,
            dustDurationMin: 3000,
            dustDurationRange: 1000,
            dustDrag: 0.98,
            dustBrownian: 0.1,
            dustFadeThreshold: 0.7,
            dustTint: 0x998877,

            scorchInnerRadiusFrac: 0.4,
            scorchMiddleRadiusFrac: 0.7,
            scorchOuterRadiusFrac: 1.2,
            scorchInnerAlpha: 0.7,
            scorchMiddleAlpha: 0.4,
            scorchOuterAlpha: 0.15,
            scorchInnerColor: 0x0a0a0a,
            scorchOuterColor: 0x111111,

            desatMinIntensity: 0.2,

            lightPhase1: { radius: 600, color: 0xffcc44, intensity: 6.0, decay: 200 },
            lightPhase2: { radius: 500, color: 0xff4400, intensity: 2.5, decay: 800, delay: 200 },

            blast: { radiusMultiplier: 2.5, strengthMultiplier: 100, duration: 600, maxDisplacement: 42 },
            vacuum: { delay: 300, radiusMultiplier: 2, strengthMultiplier: -35, duration: 400 },
            ripple: { delay: 700, radiusMultiplier: 1.5, strengthMultiplier: 20, duration: 350 },

            shakeAmplitude: 32,
            shakeRangeFactor: 6,
            shakeDuration: 800,
        },
    },
    FLASH: {
        sprite: { color: 0xffffff, radius: 6, fillAlpha: 0.9, strokeColor: 0xffffff, strokeWidth: 1, strokeAlpha: 0.4 },
        screenEffect: {
            whitePulseEnd: 0.05,
            peakHoldEnd: 0.06,
            retinalBurnEnd: 0.4,
            desatPhaseEnd: 0.7,
            retinalGradientExpansion: 0.5,
            retinalGradientDecayPower: 0.5,
            desatPeakAlpha: 0.6,
            desatGradientAlpha: 0.3,
            recoveryDesatAlpha: 0.15,
            recoveryGradientAlpha: 0.1,
            gradientColorStops: [
                { offset: 0, alpha: 1 },
                { offset: 0.3, alpha: 0.7 },
                { offset: 0.6, alpha: 0.3 },
                { offset: 1, alpha: 0 },
            ],
        },
        light: { radius: 1000, color: 0xffffff, intensity: 4.0, decay: 800 },
        gridDisplacement: { strengthMultiplier: 10, duration: 150 },
    },
    SMOKE: {
        sprite: { color: 0xaaaaaa, radius: 6, fillAlpha: 0.9, strokeColor: 0xffffff, strokeWidth: 1, strokeAlpha: 0.4 },
        cloud: {
            expandDuration: 3000,
            initialRadiusFrac: 0.12,
            emitDuration: 1200,
            sustainInterval: 400,
            radialDrift: 0.15,
            particleDrag: 0.94,
            brownianStrength: 0.35,
            centeringStrength: 0.08,
            fadeDuration: 2000,
            fovMinAlpha: 0.08,
            bulletWakeRadius: 60,
            bulletSmokeStrength: 3.0,
            rotationDrift: 0.003,
            wallBounceCoefficient: 0.3,
            lightTintBase: 0.5,
            lightTintScale: 0.8,
            initialVelocityRange: 0.5,
            maxRadiusFracBase: 0.7,
            maxRadiusFracRange: 0.6,
            boundaryOvershootBounce: 0.3,
            distanceFadeFactor: 0.3,
            layers3: [
                { alphaMin: 0.5, alphaMax: 0.7, scaleMin: 1.8, scaleMax: 2.4, tint: 0x445566, radiusFrac: 0.4 },
                { alphaMin: 0.3, alphaMax: 0.5, scaleMin: 1.2, scaleMax: 1.8, tint: 0x667788, radiusFrac: 0.7 },
                { alphaMin: 0.15, alphaMax: 0.3, scaleMin: 0.7, scaleMax: 1.2, tint: 0x8899aa, radiusFrac: 1.0 },
            ],
            layerWeights3: [0.3, 0.4, 0.3],
            layerFadeOffsets3: [1000, 1500, 2000],
            layers1: [
                { alphaMin: 0.3, alphaMax: 0.5, scaleMin: 1.2, scaleMax: 1.8, tint: 0x667788, radiusFrac: 1.0 },
            ],
            layerWeights1: [1],
            layerFadeOffsets1: [1500],
        },
        gridDisplacement: { strengthMultiplier: 8, duration: 1000 },
    },
};

export function getGrenadeVfx<T extends GrenadeType>(type: T): GrenadeVfxMap[T] {
    return GRENADE_VFX[type];
}

export function isGrenadeAllowed(type: GrenadeType): boolean {
    const allowed = getConfig().grenades.allowedGrenades;
    return allowed === 'ALL' || allowed.includes(type);
}

export function createDefaultGrenades(): Record<GrenadeType, number> {
    const starting = getConfig().grenades.startingGrenades;
    return {
        FRAG: starting.FRAG ?? 0,
        FLASH: starting.FLASH ?? 0,
        SMOKE: starting.SMOKE ?? 0,
        C4: starting.C4 ?? 0,
    };
}