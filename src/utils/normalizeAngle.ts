/**
 * Normalizes an angle in degrees to the half-open range (-180, 180].
 * @param a - Angle in degrees (any range).
 * @returns Equivalent angle in (-180, 180].
 */
export function normalizeAngle(a: number): number {
    a = a % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}
