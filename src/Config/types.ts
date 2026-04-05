export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface GameModeConfig {
    id: string;
    name: string;

    match: {
        roundDuration: number;       // ms (currently 120000)
        roundsToWin: number;         // currently 5
        roundIntermission: number;   // ms (currently 4000)
        maxPlayers: number;          // currently 20
        teamsCount: number;          // currently 2
        friendlyFire: boolean;       // currently false
    };

    economy: {
        startingMoney: number;       // currently 99999
        killRewardMultiplier: number; // 1.0
    };

    player: {
        maxHealth: number;           // 100
        startingArmor: number;       // 0
        speed: number;               // 6
        respawnTime: number;         // 3000
        armorAbsorption: number;     // 0.5
        healthBarVisibleDuration: number; // 3000
    };

    physics: {
        grenadeFriction: number;     // 0.94
        bulletSpeedMultiplier: number; // 1.0
    };

    weapons: {
        allowedWeapons: string[] | 'ALL';
        startingWeapons: string[];   // ['PISTOL']
        overrides: Record<string, Partial<WeaponDef>>;
        globalDamageMultiplier: number; // 1.0
        recoilMultiplier: number;      // 1.0
    };

    grenades: {
        allowedGrenades: GrenadeType[] | 'ALL';
        startingGrenades: Partial<Record<GrenadeType, number>>;
        chargeTime: number;          // ms to reach full charge (1000)
        minThrowFraction: number;    // minimum throw power as fraction (0.2)
    };

    ai: {
        speed: number;               // 3
        turnSpeed: number;           // 4
        detectRange: number;         // 800
        fireCone: number;            // 8
        chaseTimeout: number;        // 3000
        patrolPause: number;         // 1500
    };

    shooting: {
        recoilResetDelay: number;    // 300
    };
}
