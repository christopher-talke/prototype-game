import { createDefaultWeapon } from '@simulation/combat/weapons';

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

export type PlayerStatus = typeof PlayerStatus[keyof typeof PlayerStatus];

export const HELD_DIRECTIONS = [] as string[];

export const directions: Record<string, string> = {
    up: 'up',
    down: 'down',
    left: 'left',
    right: 'right',
};

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
            grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
        };

        players.push(player);
    }

    return players;
}
