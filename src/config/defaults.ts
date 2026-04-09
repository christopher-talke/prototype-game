import type { GameModeConfig } from './types';

export const BASE_DEFAULTS: GameModeConfig = {
    id: 'tdm',
    name: 'Team Deathmatch',

    match: {
        roundDuration: 2 * 60 * 1000,
        roundsToWin: 5,
        roundIntermission: 4000,
        maxPlayers: 20,
        teamsCount: 2,
        friendlyFire: false,
    },

    economy: {
        startingMoney: 500,
        armorCost: 200,
        disableArmor: false,
        healthCost: 100,
        disableHealth: false,
        killRewardMultiplier: 1.0,
    },

    player: {
        maxHealth: 100,
        startingArmor: 0,
        maxArmor: 100,
        speed: 6,
        respawnTime: 3000,
        armorAbsorption: 0.5,
        healthBarVisibleDuration: 3000,
    },

    physics: {
        grenadeFriction: 0.94,
        bulletSpeedMultiplier: 1.0,
    },

    weapons: {
        allowedWeapons: 'ALL',
        startingWeapons: ['PISTOL'],
        overrides: {},
        globalDamageMultiplier: 1.0,
        recoilMultiplier: 1.0,
    },

    grenades: {
        allowedGrenades: 'ALL',
        startingGrenades: {},
        chargeTime: 1000,
        minThrowFraction: 0.2,
        maximumAllowed: 3,
    },

    ai: {
        speed: 3,
        turnSpeed: 4,
        detectRange: 1100,
        fireCone: 8,
        chaseTimeout: 5000,
        patrolPause: 1500,
    },

    shooting: {
        recoilResetDelay: 300,
    },

    gameplay: {
        disableLowHealthEffects: false,
    }
};
