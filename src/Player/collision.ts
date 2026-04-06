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

export function getWallAABBs(): readonly { x: number; y: number; w: number; h: number }[] {
    return wallAABBs;
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

function collidesWithPlayer(px: number, py: number, excludeId: number, players: player_info[]): boolean {
    const cx = px + COLLISION_MARGIN;
    const cy = py + COLLISION_MARGIN;
    for (const other of players) {
        if (other.id === excludeId || other.dead) continue;
        const ox = other.current_position.x + COLLISION_MARGIN;
        const oy = other.current_position.y + COLLISION_MARGIN;
        if (cx < ox + CBOX && cx + CBOX > ox && cy < oy + CBOX && cy + CBOX > oy) {
            return true;
        }
    }
    return false;
}

export function moveWithCollision(currentX: number, currentY: number, dx: number, dy: number, excludeId?: number, players?: player_info[]): { x: number; y: number } {
    const collides = excludeId !== undefined && players
        ? (px: number, py: number) => collidesWithWall(px, py) || collidesWithPlayer(px, py, excludeId, players)
        : collidesWithWall;

    const alreadyStuck = collides(currentX, currentY);
    const newX = currentX + dx;
    const newY = currentY + dy;

    if (!collides(newX, newY)) return clampToBounds(newX, newY);
    if (dx !== 0 && !collides(currentX + dx, currentY)) return clampToBounds(currentX + dx, currentY);
    if (dy !== 0 && !collides(currentX, currentY + dy)) return clampToBounds(currentX, currentY + dy);
    if (alreadyStuck) return clampToBounds(newX, newY);
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
