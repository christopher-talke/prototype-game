/**
 * Computes the intersection of a ray and a line segment.
 * ELI5: This is the distance of where a ray touches a wall, if it does at all. If it doesn't touch the wall, it returns nothing.
 * @param ox The x-coordinate of the ray origin.
 * @param oy The y-coordinate of the ray origin.
 * @param dx The x-component of the ray direction.
 * @param dy The y-component of the ray direction.
 * @param x1 The x-coordinate of the first endpoint of the segment.
 * @param y1 The y-coordinate of the first endpoint of the segment.
 * @param x2 The x-coordinate of the second endpoint of the segment.
 * @param y2 The y-coordinate of the second endpoint of the segment.
 * @returns The distance along the ray to the intersection point, or null if no intersection.
 */
export function raySegmentIntersect(ox: number, oy: number, dx: number, dy: number, x1: number, y1: number, x2: number, y2: number): number | null {
    const sx = x2 - x1;
    const sy = y2 - y1;
    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
    const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;
    if (t >= 0 && u >= 0 && u <= 1) return t;

    return null;
}

/**
 * Checks if a line segment between two points is blocked by any wall segments.
 * @param sx The x-coordinate of the start point.
 * @param sy The y-coordinate of the start point.
 * @param tx The x-coordinate of the target point.
 * @param ty The y-coordinate of the target point.
 * @param segments The array of wall segments to check against.
 * @returns True if the line segment is blocked by any wall segment, false otherwise.
 */
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
 * Checks if a line segment between two points is blocked by any wall segments, considering an offset for thicker walls.
 * @param sx The x-coordinate of the start point.
 * @param sy The y-coordinate of the start point.
 * @param tx The x-coordinate of the target point.
 * @param ty The y-coordinate of the target point.
 * @param segments The array of wall segments to check against.
 * @returns True if the line segment is blocked by any wall segment, false otherwise.
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
