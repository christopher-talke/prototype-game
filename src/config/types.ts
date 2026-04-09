export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface GameModeConfig {
    gameplay: any;
    id: string;
    name: string;

    match: {
        roundDuration: number;
        roundsToWin: number;
        roundIntermission: number;
        maxPlayers: number;
        teamsCount: number;
        friendlyFire: boolean;
    };

    economy: {
        healthCost: number;
        disableHealth: boolean;
        armorCost: number;
        disableArmor: boolean;
        startingMoney: number;
        killRewardMultiplier: number;
    };

    player: {
        maxArmor: number;
        maxHealth: number;
        startingArmor: number;
        speed: number;
        respawnTime: number;
        armorAbsorption: number;
        healthBarVisibleDuration: number;
    };

    physics: {
        grenadeFriction: number;
        bulletSpeedMultiplier: number;
    };

    weapons: {
        allowedWeapons: string[] | 'ALL';
        startingWeapons: string[];
        overrides: Record<string, Partial<WeaponDef>>;
        globalDamageMultiplier: number;
        recoilMultiplier: number;
    };

    grenades: {
        allowedGrenades: GrenadeType[] | 'ALL';
        startingGrenades: Partial<Record<GrenadeType, number>>;
        chargeTime: number;
        minThrowFraction: number;
    };

    ai: {
        speed: number;
        turnSpeed: number;
        detectRange: number;
        fireCone: number;
        chaseTimeout: number;
        patrolPause: number;
    };

    shooting: {
        recoilResetDelay: number;
    };
}
