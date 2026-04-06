import { environment } from '../Environment/environment';
import { PLAYER_HIT_BOX } from '../constants';

const wallAABBs: { x: number; y: number; w: number; h: number }[] = [];

// Shrink collision box slightly so player doesn't snag on wall edges
const COLLISION_MARGIN = 3;
const CBOX = PLAYER_HIT_BOX - COLLISION_MARGIN * 2;

/**
 * Registers a wall's axis-aligned bounding box (AABB) for collision detection.
 * @param x The x-coordinate of the wall's top-left corner.
 * @param y The y-coordinate of the wall's top-left corner.
 * @param w The width of the wall.
 * @param h The height of the wall.
 */
export function registerWallAABB(x: number, y: number, w: number, h: number) {
    wallAABBs.push({ x, y, w, h });
}

/**
 * Checks if a point collides with any registered wall's axis-aligned bounding box (AABB).
 * @param px The x-coordinate of the point.
 * @param py The y-coordinate of the point.
 * @returns True if the point collides with a wall, false otherwise.
 */
export function collidesWithWall(px: number, py: number): boolean {
    const cx = px + COLLISION_MARGIN;
    const cy = py + COLLISION_MARGIN;
    for (const wall of wallAABBs) {
        if (cx < wall.x + wall.w && cx + CBOX > wall.x && cy < wall.y + wall.h && cy + CBOX > wall.y) {
            return true;
        }
    }
    return false;
}

/**
 * Moves a point with collision detection against registered walls.
 * @param currentX The current x-coordinate of the point.
 * @param currentY The current y-coordinate of the point.
 * @param dx The change in x-coordinate.
 * @param dy The change in y-coordinate.
 * @returns The new coordinates of the point after applying movement and collision detection.
 */
export function moveWithCollision(currentX: number, currentY: number, dx: number, dy: number): { x: number; y: number } {
    // If already inside a wall (e.g. just spawned), allow movement out
    const alreadyStuck = collidesWithWall(currentX, currentY);

    const newX = currentX + dx;
    const newY = currentY + dy;

    // Try full move
    if (!collidesWithWall(newX, newY)) {
        return clampToBounds(newX, newY);
    }

    // Try X only
    if (dx !== 0 && !collidesWithWall(currentX + dx, currentY)) {
        return clampToBounds(currentX + dx, currentY);
    }

    // Try Y only
    if (dy !== 0 && !collidesWithWall(currentX, currentY + dy)) {
        return clampToBounds(currentX, currentY + dy);
    }

    // If already stuck let them move freely to escape
    if (alreadyStuck) {
        return clampToBounds(newX, newY);
    }

    return { x: currentX, y: currentY };
}

/**
 * Clamps a point to the environment bounds.
 * @param x The x-coordinate of the point.
 * @param y The y-coordinate of the point.
 * @returns The clamped coordinates of the point.
 */
function clampToBounds(x: number, y: number): { x: number; y: number } {
    if (x < environment.limits.left) x = environment.limits.left;
    if (x > environment.limits.right - PLAYER_HIT_BOX) x = environment.limits.right - PLAYER_HIT_BOX;
    if (y < environment.limits.top) y = environment.limits.top;
    if (y > environment.limits.bottom - PLAYER_HIT_BOX) y = environment.limits.bottom - PLAYER_HIT_BOX;
    return { x, y };
}
