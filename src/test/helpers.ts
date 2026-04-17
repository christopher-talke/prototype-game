import { PlayerStatus } from '@simulation/player/playerData';
import { createDefaultWeapon } from '@simulation/combat/weapons';
import { createDefaultGrenades } from '@simulation/combat/grenades';
import { setGameMode } from '@config/activeConfig';
import { BASE_DEFAULTS } from '@config/defaults';

type AABB = { x: number; y: number; w: number; h: number };
type Limits = { left: number; right: number; top: number; bottom: number };

/**
 * Builds a `player_info` object with sensible defaults, suitable for unit
 * tests that need a live player without a full simulation setup.
 *
 * @param overrides - Partial `player_info` fields to apply on top of defaults.
 * @returns A fully populated `player_info`.
 */
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

/**
 * Constructs a plain AABB object for use in wall/collision tests.
 *
 * @param x - Left edge x.
 * @param y - Top edge y.
 * @param w - Width.
 * @param h - Height.
 */
export function makeWall(x: number, y: number, w: number, h: number): AABB {
    return { x, y, w, h };
}

/**
 * Constructs a `WallSegment` with precomputed AABB fields, mirroring the
 * shape produced by `makeSegment` in `environment.ts`, for use in raycast
 * and detection unit tests.
 *
 * @param x1 - Segment start x.
 * @param y1 - Segment start y.
 * @param x2 - Segment end x.
 * @param y2 - Segment end y.
 */
export function testSegment(x1: number, y1: number, x2: number, y2: number): WallSegment {
    return {
        x1, y1, x2, y2,
        minX: Math.min(x1, x2), minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2), maxY: Math.max(y1, y2),
    };
}

/**
 * Returns a `Limits` object for use in environment/world-bounds tests.
 *
 * @param right - Right boundary (default 3000).
 * @param bottom - Bottom boundary (default 3000).
 */
export function testLimits(right = 3000, bottom = 3000): Limits {
    return { left: 0, right, top: 0, bottom };
}

/** Resets the active game config back to `BASE_DEFAULTS` between tests. */
export function resetConfig() {
    setGameMode(BASE_DEFAULTS);
}
