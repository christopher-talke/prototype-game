/**
 * Returns the Euclidean distance between two 2D points.
 * @param sx - Source X coordinate.
 * @param sy - Source Y coordinate.
 * @param tx - Target X coordinate.
 * @param ty - Target Y coordinate.
 * @returns Distance in world units.
 */
export function getDistance(sx: number, sy: number, tx: number, ty: number) {
    const dx = tx - sx;
    const dy = ty - sy;

    return Math.sqrt(dx * dx + dy * dy);
}
