/**
 * Returns the parametric distance `t` along the ray at which it intersects the
 * line segment `(x1,y1)-(x2,y2)`, or `null` when there is no intersection.
 *
 * Uses the standard 2D ray-segment intersection formula derived from solving:
 *   P(t) = O + t*D
 *   Q(u) = A + u*(B-A)   where u in [0,1]
 *
 * Cramer's rule gives:
 *   denom = D.x * S.y - D.y * S.x   (cross product of ray dir and segment dir)
 *   t     = ((A - O) x S) / denom
 *   u     = ((A - O) x D) / denom
 *
 * Returns `null` when `denom` is near zero (parallel) or `u` is outside [0,1]
 * (miss). Does not reject negative `t`, so callers that need a forward-only
 * ray must check `t >= 0` themselves.
 *
 * @param ox - Ray origin x.
 * @param oy - Ray origin y.
 * @param dx - Ray direction x (need not be normalised for intersection, but `t`
 *             will be in direction-length units if not normalised).
 * @param dy - Ray direction y.
 * @param x1 - Segment start x.
 * @param y1 - Segment start y.
 * @param x2 - Segment end x.
 * @param y2 - Segment end y.
 * @returns Distance `t` along the ray to the intersection, or `null`.
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
 * Returns true if the segment from `(sx,sy)` to `(tx,ty)` is blocked by at
 * least one wall segment. The ray is normalised to length 1 so that `t`
 * values returned by `raySegmentIntersect` are in world units; intersections
 * within 0.5 units of either endpoint are ignored to avoid self-hits.
 *
 * @param sx - Start x.
 * @param sy - Start y.
 * @param tx - Target x.
 * @param ty - Target y.
 * @param segments - Wall segments to test against.
 * @returns `true` if any segment straddles the line.
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
 * Returns true if the straight line between two points is blocked by wall
 * geometry, using a three-ray test to handle thin walls robustly.
 *
 * Casts the direct ray plus two laterally offset rays (perpendicular to the
 * line, offset by 10 units). All three must be blocked for the function to
 * return true, reducing false positives near wall endpoints and corners.
 *
 * @param sx - Start x.
 * @param sy - Start y.
 * @param tx - Target x.
 * @param ty - Target y.
 * @param segments - Wall segments to test against.
 * @returns `true` only when all three rays are blocked.
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
