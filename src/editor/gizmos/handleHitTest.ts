/**
 * Pointer-on-handle check. Returns the handle id under the world point or
 * null if no handle is hit.
 *
 * Part of the editor layer.
 */

import type { AABB } from '../selection/boundsOf';
import { computeHandleRects, type HandleId } from './transformHandles';

/** Hit-test all transform handles for `aabb` at `zoom`. Returns the id, or null. */
export function hitTestHandle(
    aabb: AABB,
    zoom: number,
    worldX: number,
    worldY: number,
): HandleId | null {
    const handles = computeHandleRects(aabb, zoom);
    for (const h of handles) {
        const half = h.size / 2;
        if (
            worldX >= h.x - half &&
            worldX <= h.x + half &&
            worldY >= h.y - half &&
            worldY <= h.y + half
        ) {
            return h.id;
        }
    }
    return null;
}
