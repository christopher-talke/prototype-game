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

function isSingleRayBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-10) return false;
    const ndx = dx / dist;
    const ndy = dy / dist;
    for (const seg of segments) {
        const t = raySegmentIntersect(sx, sy, ndx, ndy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t > 0.5 && t < dist - 0.5) return true;
    }
    return false;
}

/**
 * Checks if a line between two points is blocked by wall segments.
 * No smoke check - safe for server-side use.
 */
export function isLineBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-10) return false;
    const OFFSET = 10;
    const px = (-dy / dist) * OFFSET;
    const py = (dx / dist) * OFFSET;

    if (!isSingleRayBlocked(sx, sy, tx, ty, segments)) return false;
    if (!isSingleRayBlocked(sx, sy, tx + px, ty + py, segments)) return false;
    if (!isSingleRayBlocked(sx, sy, tx - px, ty - py, segments)) return false;
    return true;
}
