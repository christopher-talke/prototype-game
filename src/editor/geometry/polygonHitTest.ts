/**
 * Pure hit-test helpers for the vertex-edit tool.
 *
 * Used to pick the nearest vertex or edge from a world-space pointer position,
 * within a radius expressed in world units. All functions are side-effect free.
 *
 * Part of the editor layer.
 */

import type { Vec2 } from '@shared/map/MapData';

/** Closest point on segment ab to point p. `t` is clamped to [0,1]. */
export function closestPointOnSegment(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
): { x: number; y: number; t: number } {
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return { x: ax, y: ay, t: 0 };
    let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return { x: ax + t * abx, y: ay + t * aby, t };
}

/** Squared distance from point p to segment ab. */
export function distanceToSegmentSq(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
): number {
    const c = closestPointOnSegment(px, py, ax, ay, bx, by);
    const dx = px - c.x;
    const dy = py - c.y;
    return dx * dx + dy * dy;
}

/**
 * Index of the vertex nearest to (worldX, worldY) within `radiusWorld`, or null.
 * When two vertices tie, the earlier index wins.
 */
export function pickVertex(
    vertices: Vec2[],
    worldX: number, worldY: number,
    radiusWorld: number,
): number | null {
    const r2 = radiusWorld * radiusWorld;
    let bestIdx: number | null = null;
    let bestDistSq = Infinity;
    for (let i = 0; i < vertices.length; i++) {
        const dx = vertices[i].x - worldX;
        const dy = vertices[i].y - worldY;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 && d2 < bestDistSq) {
            bestDistSq = d2;
            bestIdx = i;
        }
    }
    return bestIdx;
}

/**
 * Nearest edge (segment between vertices[i] and vertices[(i+1) % n]) to the
 * point, within `radiusWorld`. Returns the index of the edge's first vertex,
 * the clamped parametric `t` along that edge, and the closest point coords.
 */
export function pickEdge(
    vertices: Vec2[],
    worldX: number, worldY: number,
    radiusWorld: number,
): { index: number; t: number; x: number; y: number } | null {
    const n = vertices.length;
    if (n < 2) return null;
    const r2 = radiusWorld * radiusWorld;
    let best: { index: number; t: number; x: number; y: number } | null = null;
    let bestDistSq = Infinity;
    for (let i = 0; i < n; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];
        const c = closestPointOnSegment(worldX, worldY, a.x, a.y, b.x, b.y);
        const dx = worldX - c.x;
        const dy = worldY - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 && d2 < bestDistSq) {
            bestDistSq = d2;
            best = { index: i, t: c.t, x: c.x, y: c.y };
        }
    }
    return best;
}
