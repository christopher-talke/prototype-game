/**
 * Player collision detection and movement resolution.
 * Handles player-wall AABB broad-phase + optional convex-polygon fine-phase
 * (SAT), player-player overlap, and axis-separated slide movement with world
 * boundary clamping.
 *
 * Simulation layer - does not depend on rendering, net, or orchestration.
 */

import type { Vec2 } from '@shared/map/MapData';
import { PLAYER_HIT_BOX } from '../../constants';

type Limits = { left: number; right: number; top: number; bottom: number };

/**
 * Wall collision shape. `x/y/w/h` is the AABB (always required; used for
 * broad-phase). When `vertices` is present, the wall is treated as a convex
 * polygon and a SAT fine-phase test runs after the AABB overlap check.
 */
export type WallShape = { x: number; y: number; w: number; h: number; vertices?: readonly Vec2[] };

const COLLISION_MARGIN = 3;
const CBOX = PLAYER_HIT_BOX - COLLISION_MARGIN * 2;

const wallShapes: WallShape[] = [];

/**
 * Registers a wall shape for player collision. AABB is required; pass
 * `vertices` to opt in to polygon-accurate collision.
 */
export function registerWallShape(shape: WallShape) {
    wallShapes.push(shape);
}

/** Removes all registered wall shapes. Called on map change. */
export function clearWallShapes() {
    wallShapes.length = 0;
}

export function getWallShapes(): readonly WallShape[] {
    return wallShapes;
}

/**
 * Back-compat alias. `WallShape` is a structural superset of AABB, so
 * callers that read only `x/y/w/h` continue to work unchanged.
 */
export const getWallAABBs = getWallShapes;

/** Back-compat alias. */
export const clearWallAABBs = clearWallShapes;

/**
 * Back-compat registration helper for callers that only have AABB data.
 */
export function registerWallAABB(x: number, y: number, w: number, h: number) {
    wallShapes.push({ x, y, w, h });
}

/**
 * Projects a convex polygon (or AABB corners) onto an axis (ax, ay) and
 * returns the [min, max] interval of projection scalars. Axis does not need
 * to be normalized; we only compare intervals on the same axis.
 */
function projectInterval(points: readonly Vec2[], ax: number, ay: number): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
        const d = p.x * ax + p.y * ay;
        if (d < min) min = d;
        if (d > max) max = d;
    }
    return { min, max };
}

/**
 * AABB-vs-convex-polygon SAT test. Tests separating axes from both shapes:
 * the AABB's x/y axes and each polygon edge normal. Polygon must be convex
 * (editor enforces this via convex CW check).
 */
function aabbOverlapsConvexPolygon(ax: number, ay: number, aw: number, ah: number, verts: readonly Vec2[]): boolean {
    const aCorners: Vec2[] = [
        { x: ax, y: ay },
        { x: ax + aw, y: ay },
        { x: ax + aw, y: ay + ah },
        { x: ax, y: ay + ah },
    ];

    const testAxis = (axisX: number, axisY: number): boolean => {
        const a = projectInterval(aCorners, axisX, axisY);
        const b = projectInterval(verts, axisX, axisY);
        return a.max >= b.min && b.max >= a.min;
    };

    if (!testAxis(1, 0)) return false;
    if (!testAxis(0, 1)) return false;

    const n = verts.length;
    for (let i = 0; i < n; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % n];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        // edge normal (rotated 90deg)
        if (!testAxis(-ey, ex)) return false;
    }
    return true;
}

/**
 * Tests whether a player at the given position overlaps any wall. Walls with
 * a `vertices` polygon get a SAT fine-phase after the AABB broad-phase.
 * @param px - Player top-left x.
 * @param py - Player top-left y.
 * @param walls - Wall shapes to test against.
 * @returns True if the player overlaps any wall.
 */
export function collidesWithWalls(px: number, py: number, walls: readonly WallShape[]): boolean {
    const cx = px + COLLISION_MARGIN;
    const cy = py + COLLISION_MARGIN;
    for (const wall of walls) {
        if (cx < wall.x + wall.w && cx + CBOX > wall.x && cy < wall.y + wall.h && cy + CBOX > wall.y) {
            if (wall.vertices === undefined) return true;
            if (aabbOverlapsConvexPolygon(cx, cy, CBOX, CBOX, wall.vertices)) return true;
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
 * @param walls - Wall shapes for collision.
 * @param limits - World boundary for clamping.
 * @param excludeId - Optional player ID for player-player collision.
 * @param players - Optional player list for player-player collision.
 * @returns The resolved position after collision.
 */
export function moveWithCollisionPure(currentX: number, currentY: number, dx: number, dy: number, walls: readonly WallShape[], limits: Limits, excludeId?: number, players?: readonly player_info[]): { x: number; y: number } {
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
