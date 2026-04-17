import { createDefaultWeapon } from '@simulation/combat/weapons';
import { createDefaultGrenades } from '@simulation/combat/grenades';

/**
 * Enum-like constant object for player activity states.
 * Used by AuthoritativeSimulation to track what a player is doing,
 * and consumed by rendering (status labels) and UI (HUD) layers.
 */
export const PlayerStatus = {
    RELOADING: 'RELOADING',
    BUYING: 'BUYING',
    THROWING_FRAG: 'THROWING_FRAG',
    THROWING_FLASH: 'THROWING_FLASH',
    THROWING_SMOKE: 'THROWING_SMOKE',
    PLACING_C4: 'PLACING_C4',
    DEAD: 'DEAD',
    IDLE: 'IDLE',
    MOVING: 'MOVING',
    SHOOTING: 'SHOOTING',
} as const;

/** Union type of all valid player status string values. */
export type PlayerStatus = typeof PlayerStatus[keyof typeof PlayerStatus];

/** Tracks currently held movement directions for local input handling. */
export const HELD_DIRECTIONS = [] as string[];

/** Canonical direction key names used by the input system. */
export const directions: Record<string, string> = {
    up: 'up',
    down: 'down',
    left: 'left',
    right: 'right',
};

/**
 * Creates an array of player_info objects distributed evenly across teams,
 * placed at the corresponding team spawn points.
 * @param num - Total number of players to generate.
 * @param teams - Number of teams to distribute players across.
 * @param teamSpawns - Per-team spawn point arrays.
 * @returns Array of initialized player_info objects.
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
            status: PlayerStatus.IDLE,
            health: 100,
            armour: 0,
            team,
            dead: false,
            weapons: [createDefaultWeapon()],
            grenades: createDefaultGrenades(),
        };

        players.push(player);
    }

    return players;
}
