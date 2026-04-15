/**
 * Recursively makes all properties of T optional.
 * Used by the mode system to define partial overrides against {@link GameModeConfig}.
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Complete configuration for a game mode, covering every tunable knob
 * the simulation, economy, and AI systems read at runtime.
 *
 * Consumed by the simulation layer (player health, physics, weapons),
 * the orchestration layer (match flow, economy), and the AI subsystem.
 *
 * A fresh copy based on {@link BASE_DEFAULTS} is produced each time
 * a mode is applied via {@link setGameMode}.
 */
export interface GameModeConfig {
    gameplay: any;
    id: string;
    name: string;

    /** Round structure, player caps, and team layout. */
    match: {
        /** Duration of a single round in milliseconds. */
        roundDuration: number;
        /** Rounds a team must win to take the match. */
        roundsToWin: number;
        /** Pause between rounds in milliseconds. */
        roundIntermission: number;
        /** Maximum players allowed in a lobby. */
        maxPlayers: number;
        /** Number of teams (typically 2). */
        teamsCount: number;
        /** Whether teammates can damage each other. */
        friendlyFire: boolean;
    };

    /** Buy-menu economy: starting money, costs, and reward scaling. */
    economy: {
        healthCost: number;
        disableHealth: boolean;
        armorCost: number;
        disableArmor: boolean;
        startingMoney: number;
        /** Multiplier applied to base kill reward. */
        killRewardMultiplier: number;
    };

    /** Player stats: health, armor, movement, respawn. */
    player: {
        maxArmor: number;
        maxHealth: number;
        startingArmor: number;
        /** Base movement speed in world units per tick. */
        speed: number;
        /** Time before respawn in milliseconds. */
        respawnTime: number;
        /** Fraction of damage absorbed by armor (0-1). */
        armorAbsorption: number;
        /** How long an enemy health bar stays visible after taking damage (ms). */
        healthBarVisibleDuration: number;
    };

    /** Global physics multipliers for projectiles and grenades. */
    physics: {
        /** Per-tick velocity multiplier applied to rolling grenades. */
        grenadeFriction: number;
        /** Scalar on all bullet speeds. */
        bulletSpeedMultiplier: number;
    };

    /** Weapon availability, starting loadout, per-weapon overrides. */
    weapons: {
        /** Whitelist of weapon IDs or 'ALL' for no restriction. */
        allowedWeapons: string[] | 'ALL';
        /** Weapon IDs given to players on spawn. */
        startingWeapons: string[];
        /** Per-weapon property patches keyed by weapon ID. */
        overrides: Record<string, Partial<WeaponDef>>;
        /** Scalar applied to all weapon damage values. */
        globalDamageMultiplier: number;
        /** Scalar applied to all weapon recoil values. */
        recoilMultiplier: number;
    };

    /** Grenade availability, starting inventory, throw mechanics. */
    grenades: {
        /** Max grenades a player may carry at once. */
        maximumAllowed: number;
        /** Whitelist of grenade types or 'ALL'. */
        allowedGrenades: GrenadeType[] | 'ALL';
        /** Grenades given to players on spawn, keyed by type. */
        startingGrenades: Partial<Record<GrenadeType, number>>;
        /** Time to fully charge a throw in milliseconds. */
        chargeTime: number;
        /** Minimum throw power as a fraction of max (0-1). */
        minThrowFraction: number;
    };

    /** Bot behavior tuning: speeds, detection, patrol cadence. */
    ai: {
        /** Bot movement speed in world units per tick. */
        speed: number;
        /** Turning rate in degrees per tick. */
        turnSpeed: number;
        /** Max distance at which a bot can detect enemies (px). */
        detectRange: number;
        /** Half-angle of the firing cone in degrees. */
        fireCone: number;
        /** Time before a bot gives up chasing a lost target (ms). */
        chaseTimeout: number;
        /** Idle pause duration between patrol waypoints (ms). */
        patrolPause: number;
    };

    /** Shooting mechanics shared across all weapons. */
    shooting: {
        /** Delay after last shot before recoil starts resetting (ms). */
        recoilResetDelay: number;
    };
}
