import { PlayerStatus } from '@simulation/player/playerData';
import { createDefaultWeapon } from '@simulation/combat/weapons';
import { createDefaultGrenades } from '@simulation/combat/grenades';
import { setGameMode } from '@config/activeConfig';
import { BASE_DEFAULTS } from '@config/defaults';

type AABB = { x: number; y: number; w: number; h: number };
type Limits = { left: number; right: number; top: number; bottom: number };

export function makePlayer(overrides?: Partial<player_info>): player_info {
    return {
        id: 1,
        name: 'TestPlayer',
        current_position: { x: 500, y: 500, rotation: 0 },
        status: PlayerStatus.IDLE,
        health: 100,
        armour: 0,
        team: 1,
        dead: false,
        weapons: [createDefaultWeapon()],
        grenades: createDefaultGrenades(),
        ...overrides,
    };
}

export function makeWall(x: number, y: number, w: number, h: number): AABB {
    return { x, y, w, h };
}

export function testSegment(x1: number, y1: number, x2: number, y2: number): WallSegment {
    return {
        x1, y1, x2, y2,
        minX: Math.min(x1, x2), minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2), maxY: Math.max(y1, y2),
    };
}

export function testLimits(right = 3000, bottom = 3000): Limits {
    return { left: 0, right, top: 0, bottom };
}

export function resetConfig() {
    setGameMode(BASE_DEFAULTS);
}
