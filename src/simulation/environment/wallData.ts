import { environment, clearWallGeometry, makeSegment } from './environment';
import { registerWallAABB, clearWallAABBs } from '@simulation/player/collision';

/** Clears all wall geometry and AABB collision data, resetting to the empty boundary state. */
export function clearAllWallData() {
    clearWallAABBs();
    clearWallGeometry();
}

/**
 * Registers a rectangular wall into both the AABB collision system and the
 * raycast geometry, appending four segments and four corners derived from the
 * wall's bounds.
 *
 * @param wallInfo - Wall rectangle from map data (`x`, `y`, `width`, `height`).
 */
export function registerWallGeometry(wallInfo: wall_info) {
    const { x, y, width, height } = wallInfo;
    registerWallAABB(x, y, width, height);

    const left = Math.floor(x);
    const right = Math.floor(x + width);
    const top = Math.floor(y);
    const bottom = Math.floor(y + height);

    environment.segments.push(
        makeSegment(left, top, right, top),
        makeSegment(right, top, right, bottom),
        makeSegment(right, bottom, left, bottom),
        makeSegment(left, bottom, left, top),
    );

    environment.corners.push(
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
    );
}
