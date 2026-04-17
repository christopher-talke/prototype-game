import { PlayerStatus } from "./simulation/player/playerData";

declare global {
    /** Match type: free-for-all or team deathmatch. */
    type GameMode = 'ffa' | 'tdm';

    /** Which rendering backend is active. */
    type RendererType = 'dom' | 'pixi';

    /** Runtime configuration toggled via menus and debug tools. Consumed by all layers. */
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

    /** Networked snapshot of a single player's state, sent from simulation to renderers and HUD. */
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
        /** Which floor of the active map the player is currently occupying. Determines per-floor collision lookup. */
        floorId: string;
    }

    /** A weapon instance carried by a player. */
    type PlayerWeapon = {
        id: number;
        active: boolean;
        type: string;
        ammo: number;
        maxAmmo: number;
        firing_rate: number;
        reloading: boolean;
    };

    /** Static definition for a weapon type. Loaded from config, never mutated at runtime. */
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

    /** Per-player scoreboard state tracked during a match. */
    type PlayerGameState = {
        playerId: number;
        kills: number;
        deaths: number;
        money: number;
        points: number;
    };

    /** Simple 2D point in world space. */
    type coordinates = {
        x: number;
        y: number;
    };

    /** Union of all grenade type identifiers. */
    type GrenadeType = 'FRAG' | 'FLASH' | 'SMOKE' | 'C4';

    /** Visual parameters for drawing a grenade's in-world sprite. */
    type GrenadeSpriteVfx = {
        color: number;
        radius: number;
        fillAlpha: number;
        strokeColor: number;
        strokeWidth: number;
        strokeAlpha: number;
    };

    /** Parameters controlling how a grenade detonation displaces the background grid. */
    type GrenadeGridDisplacementVfx = {
        strengthMultiplier: number;
        duration: number;
    };

    /** Light emitted by a grenade effect (flash, generic detonation glow). */
    type GrenadeLightVfx = {
        radius: number;
        color: number;
        intensity: number;
        decay: number;
    };

    /** One phase within a multi-phase detonation lighting sequence (e.g. initial spike then decay). */
    type LightPhaseVfx = {
        radius: number;
        color: number;
        intensity: number;
        decay: number;
        delay?: number;
    };

    /** One phase of a multi-phase grid displacement sequence (blast, vacuum, ripple). */
    type DisplacementPhaseVfx = {
        delay?: number;
        radiusMultiplier: number;
        strengthMultiplier: number;
        duration: number;
        maxDisplacement?: number;
    };

    /** Full VFX configuration for fragmentation grenades. Consumed by `fragEffect.ts`. */
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

    /** Full VFX configuration for C4 explosive charges. Consumed by `c4Effect.ts`. */
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

    /** Full VFX configuration for flashbang grenades. Consumed by `flashEffect.ts`. */
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

    /** Visual parameters for a single volumetric layer within a smoke cloud. */
    type SmokeLayerVfx = {
        alphaMin: number;
        alphaMax: number;
        scaleMin: number;
        scaleMax: number;
        tint: number;
        radiusFrac: number;
    };

    /** Full VFX configuration for smoke grenades. Consumed by `smokeEffect.ts`. */
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

    /** Maps each grenade type to its concrete VFX configuration type. */
    type GrenadeVfxMap = {
        FRAG: FragVfx;
        C4: C4Vfx;
        FLASH: FlashVfx;
        SMOKE: SmokeVfx;
    };

    /** Visual parameters for drawing an in-flight projectile sprite. */
    type ProjectileVfx = {
        tint: number;
        scale: number;
        baseRadius: number;
        blendMode: string;
    };

    /** Dynamic light attached to a bullet in flight, rendered into the lightmap. */
    type BulletLightVfx = {
        radius: number;
        intensity: number;
        color: number;
        trailAngle: number;
    };

    /** Visual effect spawned where a bullet hits a wall surface. */
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

    /** Light flash emitted when a player is killed. */
    type DeathBurstVfx = {
        lightRadius: number;
        lightColor: number;
        lightIntensity: number;
        lightDecay: number;
    };

    /** Composite VFX bundle for a weapon, covering projectile, lighting, impacts, and grid effects. */
    type WeaponVfx = {
        projectile: ProjectileVfx;
        bulletLight: BulletLightVfx;
        wallImpact: WallImpactVfx;
        deathBurst: DeathBurstVfx;
        gridHit: { radius: number; strength: number };
        gridTravel: { radius: number; strength: number };
    };

    /** Static definition for a grenade type. Loaded from config, never mutated at runtime. */
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

    /** A point on a visibility ray: position plus distance from the ray origin. */
    type RayPoint = {
        x: number;
        y: number;
        d: number;
    };

    /** Bounding-box coordinates of a DOM element in screen space. */
    type elementCoordinates = {
        x: number;
        y: number;
        top: number;
        right: number;
        bottom: number;
        left: number;
    };

    /** Line segment of a wall edge, with pre-computed AABB for broad-phase culling. */
    type WallSegment = {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };

    /** A wall corner point used as a raycast target for FOV polygon construction. */
    type Corner = {
        x: number;
        y: number;
    };

    /** Pre-processed map geometry: boundary limits, wall segments, and corner points. */
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

    /** Configuration for the FOV raycast algorithm. */
    type raycast_config = {
        number_of_rays?: number;
        type: RaycastTypes;
    };

    /** Raycast strategy used for FOV polygon construction. */
    enum RaycastTypes {
        SPRAY = 'SPRAY',
        CORNERS = 'CORNERS',
    }
}

export {};
