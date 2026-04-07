// Pure geometry helpers - no DOM, no browser imports.
// Safe to import in server-side code.

/**
 * Returns the t value where a ray hits a line segment, or null if no hit.
 * Ray: origin + t * dir, t >= 0
 * Segment: p1 + u * (p2 - p1), 0 <= u <= 1
 */
export function raySegmentIntersect(
    ox: number, oy: number,
    dx: number, dy: number,
    x1: number, y1: number,
    x2: number, y2: number,
): number | null {
    const sx = x2 - x1;
    const sy = y2 - y1;

    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
    const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;

    if (t >= 0 && u >= 0 && u <= 1) return t;
    return null;
}

function isSingleRayBlockedPrecomputed(sx: number, sy: number, ndx: number, ndy: number, dist: number, segments: WallSegment[]): boolean {
    for (let i = 0, len = segments.length; i < len; i++) {
        const seg = segments[i];
        const t = raySegmentIntersect(sx, sy, ndx, ndy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t > 0.5 && t < dist - 0.5) return true;
    }
    return false;
}

/**
 * Checks if a line between two points is blocked by wall segments.
 * No smoke check - safe for server-side use.
 * Uses 3 rays (center + 2 offset) for accuracy at wall edges.
 * Early-returns if center ray is clear (most common case).
 */
export function isLineBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    const dx = tx - sx;
    const dy = ty - sy;
    const distSq = dx * dx + dy * dy;
    if (distSq < 1e-10) return false;
    const dist = Math.sqrt(distSq);
    const ndx = dx / dist;
    const ndy = dy / dist;

    // Center ray - if clear, line is not blocked (early return for the common case)
    if (!isSingleRayBlockedPrecomputed(sx, sy, ndx, ndy, dist, segments)) return false;

    // Center blocked - check offset rays to confirm
    const OFFSET = 10;
    const px = (-dy / dist) * OFFSET;
    const py = (dx / dist) * OFFSET;

    // Offset ray 1
    const otx1 = tx + px;
    const oty1 = ty + py;
    const odx1 = otx1 - sx;
    const ody1 = oty1 - sy;
    const odist1 = Math.sqrt(odx1 * odx1 + ody1 * ody1);
    if (odist1 > 1e-10 && !isSingleRayBlockedPrecomputed(sx, sy, odx1 / odist1, ody1 / odist1, odist1, segments)) return false;

    // Offset ray 2
    const otx2 = tx - px;
    const oty2 = ty - py;
    const odx2 = otx2 - sx;
    const ody2 = oty2 - sy;
    const odist2 = Math.sqrt(odx2 * odx2 + ody2 * ody2);
    if (odist2 > 1e-10 && !isSingleRayBlockedPrecomputed(sx, sy, odx2 / odist2, ody2 / odist2, odist2, segments)) return false;

    return true;
}
