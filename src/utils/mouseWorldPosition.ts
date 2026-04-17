let mouseWorldX = 0;
let mouseWorldY = 0;

/**
 * Updates the cached mouse position in world coordinates.
 * Called by the input system each frame after converting screen coords to world space.
 * @param x - Mouse X in world units.
 * @param y - Mouse Y in world units.
 */
export function setMouseWorldPosition(x: number, y: number) {
    mouseWorldX = x;
    mouseWorldY = y;
}

/**
 * Returns the most recently cached mouse position in world coordinates.
 * @returns Object with x and y in world units.
 */
export function getMouseWorldPosition(): { x: number; y: number } {
    return { x: mouseWorldX, y: mouseWorldY };
}
