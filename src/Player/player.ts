import './player.css';
import { ACTIVE_PLAYER, addPlayer, registerPlayerElement, registerHealthBarElement, getHealthBarElement } from '../Globals/Players';
import { app } from '../Globals/App';
import { HALF_HIT_BOX } from '../constants';
import { createDefaultWeapon } from '../Combat/weapons';
export { PLAYER_HIT_BOX, FOV } from '../constants';

// Cached child references to avoid querySelector per updateHealthBar call
const healthBarChildren = new Map<number, { bar: HTMLElement; armor: HTMLElement }>();

export const HELD_DIRECTIONS = [] as string[];

export const directions: Record<string, string> = {
    up: 'up',
    down: 'down',
    left: 'left',
    right: 'right',
};

const keys: Record<string, string | undefined> = {
    w: directions.up,
    W: directions.up,
    a: directions.left,
    A: directions.left,
    d: directions.right,
    D: directions.right,
    s: directions.down,
    S: directions.down,
};

/**
 * Creates a new player entity and adds it to the game.
 * @param playerInfo The information of the player to create.
 * @param controllable Whether the player is controllable by the local user.
 * @returns The created player entity.
 */
export function createPlayer(playerInfo: player_info, controllable: boolean = false) {
    const newPlayerEntity = window.document.createElement('div');
    const newPlayerIdentifier = playerInfo.id;

    newPlayerEntity.id = `player-${newPlayerIdentifier}`;
    newPlayerEntity.classList.add(`player`);
    if (playerInfo.id === ACTIVE_PLAYER) {
        newPlayerEntity.classList.add(`visible`);
    }
    // Remove old team class and data-player-team, use data-team for CSS
    newPlayerEntity.setAttribute('data-team', `${playerInfo.team}`);
    newPlayerEntity.setAttribute('data-player-id', `${newPlayerIdentifier}`);
    newPlayerEntity.style.transform = `translate3d(${playerInfo.current_position.x}px, ${playerInfo.current_position.y}px, 0) rotate(${playerInfo.current_position.rotation}deg)`;

    app.appendChild(newPlayerEntity);
    addPlayer(playerInfo);
    registerPlayerElement(playerInfo.id, newPlayerEntity);

    // Health bar for enemies (not the local player)
    if (!controllable) {
        const wrap = document.createElement('div');
        wrap.classList.add('player-health-wrap');
        const bar = document.createElement('div');
        bar.classList.add('player-health-bar');
        const armor = document.createElement('div');
        armor.classList.add('player-armor-bar');
        wrap.appendChild(armor);
        wrap.appendChild(bar);
        app.appendChild(wrap);
        positionHealthBar(wrap, playerInfo);
        registerHealthBarElement(playerInfo.id, wrap);
        healthBarChildren.set(playerInfo.id, { bar, armor });
    }

    return newPlayerEntity;
}

/**
 * Positions the health bar of a player based on their current position.
 * @param wrap The HTML element wrapping the health bar.
 * @param playerInfo The information of the player whose health bar is being positioned.
 */
export function positionHealthBar(wrap: HTMLElement, playerInfo: player_info) {
    const x = playerInfo.current_position.x + HALF_HIT_BOX;
    const y = playerInfo.current_position.y;
    wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

/**
 * Updates the health bar of a player based on their current health and armor.
 * @param playerInfo The information of the player whose health bar is being updated.
 * @returns void
 */
export function updateHealthBar(playerInfo: player_info) {
    const wrap = getHealthBarElement(playerInfo.id);
    if (!wrap) return;

    const cached = healthBarChildren.get(playerInfo.id);
    if (cached) {
        cached.bar.style.width = `${Math.max(0, playerInfo.health)}%`;
        cached.armor.style.width = `${Math.max(0, playerInfo.armour)}%`;
    }

    positionHealthBar(wrap, playerInfo);
}

/**
 * Generates a list of player information objects for a game.
 * @param num The number of players to generate.
 * @param teams The number of teams in the game.
 * @param teamSpawns A record mapping team numbers to their spawn coordinates.
 * @returns An array of generated player information objects.
 */
export function generatePlayers(num: number, teams: number, teamSpawns: Record<number, coordinates[]>): player_info[] {
    const players: player_info[] = [];
    const teamCounters: Record<number, number> = {};

    for (let i = 0; i < num; i++) {
        const team = Math.floor(i / Math.ceil(num / teams)) + 1;
        teamCounters[team] = teamCounters[team] ?? 0;

        const spawns = teamSpawns[team] ?? Object.values(teamSpawns).flat();
        const spawn = spawns[teamCounters[team] % spawns.length];
        teamCounters[team]++;

        const player = {
            id: i + 1,
            name: `Player${i + 1}`,
            current_position: {
                x: spawn.x,
                y: spawn.y,
                rotation: Math.random() * 360,
            },
            health: 100,
            armour: 0,
            team,
            dead: false,
            weapons: [createDefaultWeapon()],
            grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
        };

        players.push(player);
    }

    return players;
}