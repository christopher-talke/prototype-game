import type { DeepPartial } from '../types';
import type { GameModeConfig } from '../types';

export interface ModeEntry {
    id: string;
    name: string;
    description: string;
    tags: string[];
    partial: DeepPartial<GameModeConfig>;
}

export const GAME_MODES: ModeEntry[] = [
    {
        id: 'tdm',
        name: 'Team Deathmatch',
        description: 'All weapons available. First team to win 5 rounds takes the match.',
        tags: ['ALL WEAPONS', '5 ROUNDS', 'ECONOMY'],
        partial: {},
    },
    {
        id: 'snipers-only',
        name: 'Snipers Only',
        description: 'Bolt-action only. One-shot potential. Positioning wins.',
        tags: ['SNIPER', '5 ROUNDS', 'PRECISION'],
        partial: {
            weapons: {
                allowedWeapons: ['SNIPER'],
                startingWeapons: ['SNIPER'],
                overrides: {},
                globalDamageMultiplier: 1.0,
                recoilMultiplier: 1.0,
            },
            economy: { startingMoney: 0, killRewardMultiplier: 1.0 },
        },
    },
    {
        id: 'low-gravity',
        name: 'Low Gravity',
        description: 'Faster movement, quicker bullets, grenades travel further before stopping.',
        tags: ['FAST', 'ALL WEAPONS', 'PHYSICS'],
        partial: {
            player: {
                maxHealth: 100,
                startingArmor: 0,
                speed: 9,
                respawnTime: 3000,
                armorAbsorption: 0.5,
                healthBarVisibleDuration: 3000,
            },
            physics: { grenadeFriction: 0.98, bulletSpeedMultiplier: 1.3 },
        },
    },
    {
        id: 'one-shot-kill',
        name: 'One-Shot Kill',
        description: 'All players have 1 HP. Every hit is lethal. No margin for error.',
        tags: ['1 HP', '5 ROUNDS', 'LETHAL'],
        partial: {
            player: {
                maxHealth: 1,
                startingArmor: 0,
                speed: 6,
                respawnTime: 1500,
                armorAbsorption: 0,
                healthBarVisibleDuration: 3000,
            },
            economy: {
                disableArmor: true,
                disableHealth: true,
            },
            weapons: {
                allowedWeapons: 'ALL',
                startingWeapons: ['PISTOL'],
                overrides: {},
                globalDamageMultiplier: 100,
                recoilMultiplier: 0.3,
            },
            gameplay: {
                disableLowHealthEffects: true,
            }
        },
    },
    {
        id: 'chaos',
        name: 'Chaos',
        description: '32 v 32 mayhem. All weapons. Fast respawns. Nonstop action.',
        tags: ['32v32', 'ALL WEAPONS', 'FAST RESPAWN'],
        partial: {
            match: {
                maxPlayers: 64,
                teamsCount: 2,
                roundDuration: 180000,
                roundsToWin: 3,
                roundIntermission: 5000,
            },
            player: {
                maxHealth: 100,
                startingArmor: 0,
                speed: 7,
                respawnTime: 1000,
                armorAbsorption: 0.5,
                healthBarVisibleDuration: 3000
            },
            weapons: {
                allowedWeapons: 'ALL',
                startingWeapons: ['RIFLE', 'PISTOL', 'GRENADE'],
                overrides: {},
                globalDamageMultiplier: 1.0,
                recoilMultiplier: 1.0,
            },
            grenades: {
                allowedGrenades: 'ALL',
                startingGrenades: { FRAG: 4, FLASH: 4, SMOKE: 4, C4: 4 },
                chargeTime: 1000,
                minThrowFraction: 0.2,
            },
        },
    }
];

export const GAME_MODES_MAP = new Map<string, ModeEntry>(GAME_MODES.map((m) => [m.id, m]));
