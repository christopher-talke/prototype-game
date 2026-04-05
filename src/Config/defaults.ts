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
        startingMoney: 99999,
        killRewardMultiplier: 1.0,
    },

    player: {
        maxHealth: 100,
        startingArmor: 0,
        speed: 6,
        respawnTime: 3000,
        armorAbsorption: 0.5,
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
    },

    ai: {
        speed: 3,
        turnSpeed: 4,
        detectRange: 800,
        fireCone: 8,
        chaseTimeout: 3000,
        patrolPause: 1500,
    },

    shooting: {
        recoilResetDelay: 300,
    },
};
