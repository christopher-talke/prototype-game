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
        tags: ['1 HP', 'LETHAL', 'FAST ROUNDS'],
        partial: {
            player: {
                maxHealth: 1,
                startingArmor: 0,
                speed: 6,
                respawnTime: 1500,
                armorAbsorption: 0,
                healthBarVisibleDuration: 3000,
            },
            weapons: {
                allowedWeapons: 'ALL',
                startingWeapons: ['PISTOL'],
                overrides: {},
                globalDamageMultiplier: 100,
                recoilMultiplier: 0.3,
            },
        },
    },
];

export const GAME_MODES_MAP = new Map<string, ModeEntry>(GAME_MODES.map((m) => [m.id, m]));
