import { environment, clearWallGeometry } from './environment';
import { registerWallAABB, clearWallAABBs } from '@simulation/player/collision';
import { clearRenderedWalls } from '@rendering/wallRenderer';

/**
 * Registers the geometry of a wall in the environment, including its axis-aligned bounding box (AABB) for collision detection.
 * @param wallInfo The information about the wall, including its position and dimensions.
 */
export function clearAllWallData() {
    clearWallAABBs();
    clearWallGeometry();
    clearRenderedWalls();
}

export function registerWallGeometry(wallInfo: wall_info) {
    const { x, y, width, height } = wallInfo;
    registerWallAABB(x, y, width, height);

    const left = Math.floor(x);
    const right = Math.floor(x + width);
    const top = Math.floor(y);
    const bottom = Math.floor(y + height);

    environment.segments.push(
        { x1: left, y1: top, x2: right, y2: top },
        { x1: right, y1: top, x2: right, y2: bottom },
        { x1: right, y1: bottom, x2: left, y2: bottom },
        { x1: left, y1: bottom, x2: left, y2: top },
    );

    environment.corners.push(
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
    );
}
