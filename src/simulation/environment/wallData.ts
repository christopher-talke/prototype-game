import type { Wall } from '@shared/map/MapData';
import { environment, clearWallGeometry, makeSegment } from './environment';
import { registerWallAABB, clearWallAABBs } from '@simulation/player/collision';

/** Clears all wall geometry and AABB collision data, resetting to the empty boundary state. */
export function clearAllWallData() {
    clearWallAABBs();
    clearWallGeometry();
}

/**
 * Registers a polygonal wall into both the AABB collision system and the
 * raycast geometry. AABB collision uses the wall's bounding box; raycast
 * segments are the polygon's edges (consecutive vertex pairs, closed).
 */
export function registerWallGeometry(wall: Wall) {
    const verts = wall.vertices;
    if (verts.length < 3) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    registerWallAABB(minX, minY, maxX - minX, maxY - minY);

    const n = verts.length;
    for (let i = 0; i < n; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % n];
        environment.segments.push(makeSegment(Math.floor(a.x), Math.floor(a.y), Math.floor(b.x), Math.floor(b.y)));
    }
    for (const v of verts) {
        environment.corners.push({ x: Math.floor(v.x), y: Math.floor(v.y) });
    }
}
