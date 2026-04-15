/**
 * Converts held direction keys into a normalized movement vector.
 *
 * Orchestration layer - reads the shared {@link HELD_DIRECTIONS} array
 * (populated by the input controller) and produces a unit-length dx/dy
 * pair. Diagonal movement is normalized to prevent speed advantage.
 */

import { HELD_DIRECTIONS, directions } from '@simulation/player/playerData';

/**
 * Computes the movement direction vector from currently held keys.
 * Returns {0,0} when no movement keys are pressed. Diagonal inputs are
 * normalized to magnitude 1 so diagonal movement is not faster.
 * @returns Object with dx and dy components in the range [-1, 1].
 */
export function getMovementInput(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;

    for (const dir of HELD_DIRECTIONS) {
        if (dir === directions.right) dx = 1;
        if (dir === directions.left) dx = -1;
        if (dir === directions.down) dy = 1;
        if (dir === directions.up) dy = -1;
    }

    if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
    }

    return { dx, dy };
}
