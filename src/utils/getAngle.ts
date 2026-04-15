/**
 * Returns the angle in degrees from source to target, measured clockwise from the positive X axis.
 * @param sx - Source X coordinate.
 * @param sy - Source Y coordinate.
 * @param tx - Target X coordinate.
 * @param ty - Target Y coordinate.
 * @returns Angle in degrees (-180 to 180).
 */
export function getAngle(sx: number, sy: number, tx: number, ty: number): number {
    return (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
}
