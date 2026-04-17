/**
 * Player collision detection and movement resolution.
 * Handles player-wall AABB overlap, player-player overlap, and
 * axis-separated slide movement with world boundary clamping.
 *
 * Simulation layer - does not depend on rendering, net, or orchestration.
 */

import { PLAYER_HIT_BOX } from '../../constants';

type AABB = { x: number; y: number; w: number; h: number };
type Limits = { left: number; right: number; top: number; bottom: number };
const COLLISION_MARGIN = 3;
const CBOX = PLAYER_HIT_BOX - COLLISION_MARGIN * 2;

const wallAABBs: AABB[] = [];

/**
 * Registers a wall AABB for client-side player collision.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param w - Width.
 * @param h - Height.
 */
export function registerWallAABB(x: number, y: number, w: number, h: number) {
    wallAABBs.push({ x, y, w, h });
}

/** Removes all registered wall AABBs. Called on map change. */
export function clearWallAABBs() {
    wallAABBs.length = 0;
}

export function getWallAABBs(): readonly AABB[] {
    return wallAABBs;
}

/**
 * Tests whether a player at the given position overlaps any wall AABB.
 * Uses a shrunken collision box (COLLISION_MARGIN inset on each side).
 * @param px - Player top-left x.
 * @param py - Player top-left y.
 * @param walls - Wall AABBs to test against.
 * @returns True if the player overlaps any wall.
 */
export function collidesWithWalls(px: number, py: number, walls: readonly AABB[]): boolean {
    const cx = px + COLLISION_MARGIN;
    const cy = py + COLLISION_MARGIN;
    for (const wall of walls) {
        if (cx < wall.x + wall.w && cx + CBOX > wall.x && cy < wall.y + wall.h && cy + CBOX > wall.y) {
            return true;
        }
    }
    return false;
}

/**
 * Tests whether a player at the given position overlaps any other living player.
 * @param px - Player top-left x.
 * @param py - Player top-left y.
 * @param excludeId - Player ID to skip (the moving player).
 * @param players - All players to test against.
 * @returns True if the player overlaps another living player.
 */
export function collidesWithPlayers(px: number, py: number, excludeId: number, players: readonly player_info[]): boolean {
    const cx = px + COLLISION_MARGIN;
    const cy = py + COLLISION_MARGIN;
    for (const other of players) {
        if (other.id === excludeId || other.dead) continue;
        const ox = other.current_position.x + COLLISION_MARGIN;
        const oy = other.current_position.y + COLLISION_MARGIN;
        if (cx < ox + CBOX && cx + CBOX > ox && cy < oy + CBOX && cy + CBOX > oy) {
            return true;
        }
    }
    return false;
}

/**
 * Clamps a position to within the world boundary limits.
 * @param x - Position x.
 * @param y - Position y.
 * @param limits - World boundary rectangle.
 * @returns Clamped position.
 */
export function clampToBounds(x: number, y: number, limits: Limits): { x: number; y: number } {
    if (x < limits.left) x = limits.left;
    if (x > limits.right - PLAYER_HIT_BOX) x = limits.right - PLAYER_HIT_BOX;
    if (y < limits.top) y = limits.top;
    if (y > limits.bottom - PLAYER_HIT_BOX) y = limits.bottom - PLAYER_HIT_BOX;
    return { x, y };
}

/**
 * Moves a player by (dx, dy) with wall and player collision, using axis separation.
 * Tries full diagonal move first, then x-only, then y-only, falling back to no movement.
 * @param currentX - Current player x.
 * @param currentY - Current player y.
 * @param dx - Desired x displacement.
 * @param dy - Desired y displacement.
 * @param walls - Wall AABBs for collision.
 * @param limits - World boundary for clamping.
 * @param excludeId - Optional player ID for player-player collision.
 * @param players - Optional player list for player-player collision.
 * @returns The resolved position after collision.
 */
export function moveWithCollisionPure(currentX: number, currentY: number, dx: number, dy: number, walls: readonly AABB[], limits: Limits, excludeId?: number, players?: readonly player_info[]): { x: number; y: number } {
    const collides = excludeId !== undefined && players
        ? (px: number, py: number) => collidesWithWalls(px, py, walls) || collidesWithPlayers(px, py, excludeId, players)
        : (px: number, py: number) => collidesWithWalls(px, py, walls);

    const newX = currentX + dx;
    const newY = currentY + dy;

    if (!collides(newX, newY)) return clampToBounds(newX, newY, limits);
    if (dx !== 0 && !collides(currentX + dx, currentY)) return clampToBounds(currentX + dx, currentY, limits);
    if (dy !== 0 && !collides(currentX, currentY + dy)) return clampToBounds(currentX, currentY + dy, limits);

    return { x: currentX, y: currentY };
}
