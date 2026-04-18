/**
 * Polygon geometry helpers shared by Wall and Zone draw tools.
 *
 * Coordinate system: Y-down, origin top-left, CW winding. In Y-down, a
 * convex CW polygon has non-positive cross products for every consecutive
 * edge pair; the shoelace signed area is non-positive.
 *
 * Part of the editor layer.
 */

import type { Vec2 } from '@shared/map/MapData';

export interface ConvexityResult {
    convex: boolean;
    offendingIndex: number | null;
}

/**
 * Winding-agnostic convexity test. A polygon is convex iff every vertex
 * turns in the same direction (all cross products have the same sign, or
 * zero for a colinear vertex). Returns the first vertex whose cross sign
 * flips as the offender. Winding is enforced separately by `enforceCW`.
 * Polygons with fewer than 3 vertices are trivially convex.
 */
export function isConvexCW(vertices: Vec2[]): ConvexityResult {
    const n = vertices.length;
    if (n < 3) return { convex: true, offendingIndex: null };
    let sign = 0;
    for (let i = 0; i < n; i++) {
        const a = vertices[(i - 1 + n) % n];
        const b = vertices[i];
        const c = vertices[(i + 1) % n];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const bcx = c.x - b.x;
        const bcy = c.y - b.y;
        const cross = abx * bcy - aby * bcx;
        if (cross === 0) continue;
        const s = cross > 0 ? 1 : -1;
        if (sign === 0) sign = s;
        else if (s !== sign) return { convex: false, offendingIndex: i };
    }
    return { convex: true, offendingIndex: null };
}

/**
 * Force CW winding by reversing vertex order if the shoelace area is
 * positive (i.e. drawn CCW in Y-down). Returns a new array; does not mutate.
 */
export function enforceCW(vertices: Vec2[]): Vec2[] {
    if (vertices.length < 3) return [...vertices];
    if (signedArea(vertices) > 0) {
        const rev = [...vertices];
        rev.reverse();
        return rev;
    }
    return [...vertices];
}

/** Shoelace signed area. Positive = CCW in Y-down. */
export function signedArea(vertices: Vec2[]): number {
    let sum = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];
        sum += (b.x - a.x) * (b.y + a.y);
    }
    return sum / 2;
}

/**
 * Four CW vertices of the axis-aligned rectangle spanning a -> b.
 * Handles any diagonal direction; output is always CW in Y-down.
 */
export function rectangleVertices(a: Vec2, b: Vec2): Vec2[] {
    const x0 = Math.min(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
    ];
}

/**
 * Four CW vertices of a thin rectangle along the line a -> b with the
 * given thickness (total width perpendicular to the line).
 */
export function lineWallVertices(a: Vec2, b: Vec2, thickness: number): Vec2[] {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
        const h = thickness / 2;
        return [
            { x: a.x - h, y: a.y - h },
            { x: a.x + h, y: a.y - h },
            { x: a.x + h, y: a.y + h },
            { x: a.x - h, y: a.y + h },
        ];
    }
    const nx = -dy / len;
    const ny = dx / len;
    const h = thickness / 2;
    const v: Vec2[] = [
        { x: a.x + nx * h, y: a.y + ny * h },
        { x: b.x + nx * h, y: b.y + ny * h },
        { x: b.x - nx * h, y: b.y - ny * h },
        { x: a.x - nx * h, y: a.y - ny * h },
    ];
    return enforceCW(v);
}

/**
 * Adjust `b` so that the rectangle from `a -> b` is a square. The larger of
 * |dx|, |dy| wins; the sign of the smaller is preserved.
 */
export function squareFromDrag(a: Vec2, b: Vec2): Vec2 {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    return { x: a.x + sx * size, y: a.y + sy * size };
}

/** True if `pt` is within `radius` world units of `first`. */
export function closeWithinRadius(pt: Vec2, first: Vec2, radius: number): boolean {
    const dx = pt.x - first.x;
    const dy = pt.y - first.y;
    return dx * dx + dy * dy <= radius * radius;
}

/** Centroid of a polygon (mean of vertices). */
export function polygonCentroid(vertices: Vec2[]): Vec2 {
    if (vertices.length === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (const v of vertices) {
        sx += v.x;
        sy += v.y;
    }
    return { x: sx / vertices.length, y: sy / vertices.length };
}
