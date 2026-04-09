import { PLAYER_HIT_BOX } from '../../constants';
import { environment } from '@simulation/environment/environment';

type AABB = { x: number; y: number; w: number; h: number };
type Limits = { left: number; right: number; top: number; bottom: number };

const COLLISION_MARGIN = 3;
const CBOX = PLAYER_HIT_BOX - COLLISION_MARGIN * 2;

// -- Module-level wall registry (singleton for client-side use) --

const wallAABBs: AABB[] = [];

export function registerWallAABB(x: number, y: number, w: number, h: number) {
    wallAABBs.push({ x, y, w, h });
}

export function getWallAABBs(): readonly AABB[] {
    return wallAABBs;
}

// -- Pure collision functions (parameterized, usable by AuthoritativeSimulation) --

export function collidesWithWalls(px: number, py: number, walls: readonly AABB[]): boolean {
    const cx = px + COLLISION_MARGIN;
    const cy = py + COLLISION_MARGIN;
    for (const wall of walls) {
        if (cx < wall.x + wall.w && cx + CBOX > wall.x && cy < wall.y + wall.h && cy + CBOX > wall.y) {
            return true;
        }
    }
    return false;
}

export function collidesWithPlayers(px: number, py: number, excludeId: number, players: readonly player_info[]): boolean {
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

export function clampToBounds(x: number, y: number, limits: Limits): { x: number; y: number } {
    if (x < limits.left) x = limits.left;
    if (x > limits.right - PLAYER_HIT_BOX) x = limits.right - PLAYER_HIT_BOX;
    if (y < limits.top) y = limits.top;
    if (y > limits.bottom - PLAYER_HIT_BOX) y = limits.bottom - PLAYER_HIT_BOX;
    return { x, y };
}

export function moveWithCollisionPure(
    currentX: number, currentY: number,
    dx: number, dy: number,
    walls: readonly AABB[],
    limits: Limits,
    excludeId?: number,
    players?: readonly player_info[],
): { x: number; y: number } {
    const collides = excludeId !== undefined && players
        ? (px: number, py: number) => collidesWithWalls(px, py, walls) || collidesWithPlayers(px, py, excludeId, players)
        : (px: number, py: number) => collidesWithWalls(px, py, walls);

    const alreadyStuck = collides(currentX, currentY);
    const newX = currentX + dx;
    const newY = currentY + dy;

    if (!collides(newX, newY)) return clampToBounds(newX, newY, limits);
    if (dx !== 0 && !collides(currentX + dx, currentY)) return clampToBounds(currentX + dx, currentY, limits);
    if (dy !== 0 && !collides(currentX, currentY + dy)) return clampToBounds(currentX, currentY + dy, limits);
    if (alreadyStuck) return clampToBounds(newX, newY, limits);
    return { x: currentX, y: currentY };
}

// -- Convenience wrapper using module singleton (for WebSocketAdapter client prediction) --


export function moveWithCollision(
    currentX: number, currentY: number,
    dx: number, dy: number,
    excludeId?: number,
    players?: player_info[],
): { x: number; y: number } {
    return moveWithCollisionPure(currentX, currentY, dx, dy, wallAABBs, environment.limits, excludeId, players);
}
