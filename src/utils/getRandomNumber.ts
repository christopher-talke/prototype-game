/**
 * Returns a random integer between min and max (inclusive).
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (inclusive).
 * @returns A random integer in [min, max].
 */
export function getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
