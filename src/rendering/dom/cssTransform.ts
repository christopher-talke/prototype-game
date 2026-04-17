/**
 * Builds a GPU-accelerated CSS transform string for positioning DOM elements.
 * Uses translate3d to trigger compositing and optionally appends rotation.
 * @param x - X position in pixels
 * @param y - Y position in pixels
 * @param rotation - Optional rotation in degrees
 * @returns CSS transform string
 */
export function cssTransform(x: number, y: number, rotation?: number): string {
    if (rotation !== undefined) {
        return `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
    }

    return `translate3d(${x}px, ${y}px, 0)`;
}
