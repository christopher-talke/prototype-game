import { PlayerStatus } from "./simulation/player/playerData";

declare global {
    type GameMode = 'ffa' | 'tdm';

    type RendererType = 'dom' | 'pixi';

    interface GameSettings {
        debug: boolean;
        gameMode: GameMode;
        renderer: RendererType;
        raycast: {
            type: 'CORNERS' | 'DISABLED' | 'SPRAY';
        };
        audio: {
            masterVolume: number;
            sfxVolume: number;
            musicVolume: number;
            muted: boolean;
        };
    }

    interface player_info {
        id: number;
        name: string;
        current_position: {
            x: number;
            y: number;
            rotation: number;
        };
        status: PlayerStatus;
        health: number;
        armour: number;
        team: number;
        dead: boolean;
        weapons: PlayerWeapon[];
        grenades: Record<GrenadeType, number>;
    }

    type PlayerWeapon = {
        id: number;
        active: boolean;
        type: string;
        ammo: number;
        maxAmmo: number;
        firing_rate: number;
        reloading: boolean;
    };

    type WeaponDef = {
        id: string;
        name: string;
        damage: number;
        fireRate: number;
        reloadTime: number;
        magSize: number;
        bulletSpeed: number;
        price: number;
        killReward: number;
        pellets: number;
        spread: number;
        cameraOffset: number;
        recoilPattern: { x: number; y: number }[];
        mechanicalSound?: string;
        mechanicalDelay?: number;
        shellReloadTime?: number;
    };

    type ProjectileState = {
        id: number;
        x: number;
        y: number;
        dx: number;
        dy: number;
        speed: number;
        damage: number;
        ownerId: number;
        element: HTMLElement;
        alive: boolean;
        poolIndex: number;
        weaponType?: string;
    };

    type PlayerGameState = {
        playerId: number;
        kills: number;
        deaths: number;
        money: number;
        points: number;
    };

    interface wall_info {
        x: number;
        y: number;
        width: number;
        height: number;
        type?: WallType;
        sprite?: string;
    }

    type WallType =
        | 'concrete'
        | 'metal'
        | 'crate'
        | 'sandbag'
        | 'barrier'
        | 'pillar';

    type coordinates = {
        x: number;
        y: number;
    };

    type GrenadeType = 'FRAG' | 'FLASH' | 'SMOKE' | 'C4';

    // --- Grenade VFX types ---

    type GrenadeSpriteVfx = {
        color: number;
        radius: number;
        fillAlpha: number;
        strokeColor: number;
        strokeWidth: number;
        strokeAlpha: number;
    };

    type GrenadeGridDisplacementVfx = {
        strengthMultiplier: number;
        duration: number;
    };

    type GrenadeLightVfx = {
        radius: number;
        color: number;
        intensity: number;
        decay: number;
    };

    type LightPhaseVfx = {
        radius: number;
        color: number;
        intensity: number;
        decay: number;
        delay?: number;
    };

    type DisplacementPhaseVfx = {
        delay?: number;
        radiusMultiplier: number;
        strengthMultiplier: number;
        duration: number;
        maxDisplacement?: number;
    };

    type FragVfx = {
        sprite: GrenadeSpriteVfx;
        explosion: {
            ringCountMin: number;
            ringCountMax: number;
            ringStaggerMs: number;
            ringDurationMin: number;
            ringDurationMax: number;
            ringStrokeWidthMin: number;
            ringStrokeWidthRange: number;
            ringColors: readonly number[];
            ringInitialScale: number;
            ringBlendMode: string;
            ringDisplacementRadiusFrac: number;
            ringDisplacementStrengthMultiplier: number;

            emissiveSpeedMin: number;
            emissiveSpeedRange: number;
            emissiveScaleMin: number;
            emissiveScaleRange: number;
            emissiveDurationMin: number;
            emissiveDurationRange: number;
            emissiveDrag: number;
            emissiveRotationSpeed: number;
            emissiveTints: readonly number[];
            emissiveBlendMode: string;
            emissiveInitialAlpha: number;

            darkDebrisSpeedMin: number;
            darkDebrisSpeedRange: number;
            darkDebrisScaleMin: number;
            darkDebrisScaleRange: number;
            darkDebrisDurationMin: number;
            darkDebrisDurationRange: number;
            darkDebrisDrag: number;
            darkDebrisGravity: number;
            darkDebrisRotationSpeed: number;
            darkDebrisTints: readonly number[];
            darkDebrisInitialAlpha: number;

            secondarySparkScaleMin: number;
            secondarySparkScaleRange: number;
            secondarySparkDurationMin: number;
            secondarySparkDurationRange: number;
            secondarySparkDecay: number;
            secondarySparkTint: number;
            secondarySparkInitialAlpha: number;

            scorchInnerRadiusFrac: number;
            scorchMiddleRadiusFrac: number;
            scorchInnerAlpha: number;
            scorchMiddleAlpha: number;
            scorchOuterAlpha: number;
            scorchColor: number;

            lightPhase1: LightPhaseVfx;
            lightPhase2: LightPhaseVfx;

            blast: DisplacementPhaseVfx;
            vacuum: DisplacementPhaseVfx;

            shakeAmplitude: number;
            shakeRangeFactor: number;
            shakeDuration: number;
        };
    };

    type C4Vfx = {
        sprite: GrenadeSpriteVfx;
        explosion: {
            ringCount: number;
            ringDuration: number;
            ringDurationRange: number;
            ringStaggerMs: number;
            ringRadiusMultiplier: number;
            ringStrokeWidthMin: number;
            ringStrokeWidthRange: number;
            ringColors: readonly number[];
            ringInitialScale: number;
            ringBlendMode: string;

            emissiveSpeedMin: number;
            emissiveSpeedRange: number;
            emissiveScaleMin: number;
            emissiveScaleRange: number;
            emissiveDurationMin: number;
            emissiveDurationRange: number;
            emissiveDrag: number;
            emissiveRotationSpeed: number;
            emissiveTints: readonly number[];
            emissiveBlendMode: string;
            emissiveInitialAlpha: number;

            darkDebrisSpeedMin: number;
            darkDebrisSpeedRange: number;
            darkDebrisScaleMin: number;
            darkDebrisScaleRange: number;
            darkDebrisDurationMin: number;
            darkDebrisDurationRange: number;
            darkDebrisDrag: number;
            darkDebrisGravity: number;
            darkDebrisRotationSpeed: number;
            darkDebrisTints: readonly number[];
            darkDebrisInitialAlpha: number;

            dustSpeedMin: number;
            dustSpeedRange: number;
            dustScaleMin: number;
            dustScaleRange: number;
            dustAlphaMin: number;
            dustAlphaRange: number;
            dustDurationMin: number;
            dustDurationRange: number;
            dustDrag: number;
            dustBrownian: number;
            dustFadeThreshold: number;
            dustTint: number;

            scorchInnerRadiusFrac: number;
            scorchMiddleRadiusFrac: number;
            scorchOuterRadiusFrac: number;
            scorchInnerAlpha: number;
            scorchMiddleAlpha: number;
            scorchOuterAlpha: number;
            scorchInnerColor: number;
            scorchOuterColor: number;

            desatMinIntensity: number;

            lightPhase1: LightPhaseVfx;
            lightPhase2: LightPhaseVfx;

            blast: DisplacementPhaseVfx;
            vacuum: DisplacementPhaseVfx;
            ripple: DisplacementPhaseVfx;

            shakeAmplitude: number;
            shakeRangeFactor: number;
            shakeDuration: number;
        };
    };

    type FlashVfx = {
        sprite: GrenadeSpriteVfx;
        screenEffect: {
            whitePulseEnd: number;
            peakHoldEnd: number;
            retinalBurnEnd: number;
            desatPhaseEnd: number;
            retinalGradientExpansion: number;
            retinalGradientDecayPower: number;
            desatPeakAlpha: number;
            desatGradientAlpha: number;
            recoveryDesatAlpha: number;
            recoveryGradientAlpha: number;
            gradientColorStops: readonly { offset: number; alpha: number }[];
        };
        light: GrenadeLightVfx;
        gridDisplacement: GrenadeGridDisplacementVfx;
    };

    type SmokeLayerVfx = {
        alphaMin: number;
        alphaMax: number;
        scaleMin: number;
        scaleMax: number;
        tint: number;
        radiusFrac: number;
    };

    type SmokeVfx = {
        sprite: GrenadeSpriteVfx;
        cloud: {
            expandDuration: number;
            initialRadiusFrac: number;
            emitDuration: number;
            sustainInterval: number;
            radialDrift: number;
            particleDrag: number;
            brownianStrength: number;
            centeringStrength: number;
            fadeDuration: number;
            fovMinAlpha: number;
            bulletWakeRadius: number;
            bulletSmokeStrength: number;
            rotationDrift: number;
            wallBounceCoefficient: number;
            lightTintBase: number;
            lightTintScale: number;
            initialVelocityRange: number;
            maxRadiusFracBase: number;
            maxRadiusFracRange: number;
            boundaryOvershootBounce: number;
            distanceFadeFactor: number;
            layers3: readonly SmokeLayerVfx[];
            layerWeights3: readonly number[];
            layerFadeOffsets3: readonly number[];
            layers1: readonly SmokeLayerVfx[];
            layerWeights1: readonly number[];
            layerFadeOffsets1: readonly number[];
        };
        gridDisplacement: GrenadeGridDisplacementVfx;
    };

    type GrenadeVfxMap = {
        FRAG: FragVfx;
        C4: C4Vfx;
        FLASH: FlashVfx;
        SMOKE: SmokeVfx;
    };

    // --- Weapon VFX types ---

    type ProjectileVfx = {
        tint: number;
        scale: number;
        baseRadius: number;
        blendMode: string;
    };

    type BulletLightVfx = {
        radius: number;
        intensity: number;
        color: number;
        trailAngle: number;
    };

    type WallImpactVfx = {
        outerRadius: number;
        outerColor: number;
        outerAlpha: number;
        innerRadius: number;
        innerColor: number;
        innerAlpha: number;
        duration: number;
        initialScale: number;
        blendMode: string;
        lightRadius: number;
        lightColor: number;
        lightIntensity: number;
        lightDecay: number;
    };

    type DeathBurstVfx = {
        lightRadius: number;
        lightColor: number;
        lightIntensity: number;
        lightDecay: number;
    };

    type WeaponVfx = {
        projectile: ProjectileVfx;
        bulletLight: BulletLightVfx;
        wallImpact: WallImpactVfx;
        deathBurst: DeathBurstVfx;
        gridHit: { radius: number; strength: number };
        gridTravel: { radius: number; strength: number };
    };

    type GrenadeDef = {
        id: GrenadeType;
        name: string;
        price: number;
        throwSpeed: number;
        fuseTime: number;
        radius: number;
        damage: number;
        effectDuration: number;
        shrapnelCount?: number;
        shrapnelDamage?: number;
        shrapnelSpeed?: number;
    };

    type GrenadeState = {
        id: number;
        type: GrenadeType;
        x: number;
        y: number;
        dx: number;
        dy: number;
        speed: number;
        ownerId: number;
        element: HTMLElement;
        spawnTime: number;
        detonated: boolean;
    };

    type LightDef = {
        x: number;
        y: number;
        radius: number;
        color?: number;
        intensity?: number;
        angle?: number;
        cone?: number;
    };

    type LightingConfig = {
        ambientLight?: number;
        ambientColor?: number;
    };

    type MapData = {
        bounds?: { width: number; height: number };
        teamSpawns: Record<number, coordinates[]>;
        patrolPoints: coordinates[];
        walls: wall_info[];
        lights?: LightDef[];
        lighting?: LightingConfig;
    };

    type RayPoint = {
        x: number;
        y: number;
        d: number;
    };

    type elementCoordinates = {
        x: number;
        y: number;
        top: number;
        right: number;
        bottom: number;
        left: number;
    };

    type WallSegment = {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        // Pre-computed AABB for broad-phase culling
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };

    type Corner = {
        x: number;
        y: number;
    };

    type Environment = {
        limits: {
            left: number;
            right: number;
            top: number;
            bottom: number;
        };
        segments: WallSegment[];
        corners: Corner[];
    };

    type raycast_config = {
        number_of_rays?: number;
        type: RaycastTypes;
    };

    enum RaycastTypes {
        SPRAY = 'SPRAY',
        CORNERS = 'CORNERS',
    }
}

export {};
