/**
 * Draws the 8 corner/edge resize handles + a rotation handle + pivot crosshair
 * for a single-selection bounding box.
 *
 * Handle screen sizes are constants in screen pixels; we receive the camera
 * zoom from the caller and divide so the handles stay the same visual size at
 * any zoom.
 *
 * Part of the editor layer.
 */

import type { Graphics } from 'pixi.js';

import type { AABB } from '../selection/boundsOf';

const COLOR = 0x00e5ff;
const HANDLE_PX = 8;
const EDGE_PX = 6;
const ROTATE_OFFSET_PX = 24;

export type HandleId =
    | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br'
    | 'edge-t' | 'edge-r' | 'edge-b' | 'edge-l'
    | 'rotate' | 'pivot';

export interface HandleRect {
    id: HandleId;
    x: number;
    y: number;
    size: number;
}

/** Compute the world-space rectangles for all handles on `aabb` at `zoom`. */
export function computeHandleRects(aabb: AABB, zoom: number): HandleRect[] {
    const cornerSize = HANDLE_PX / zoom;
    const edgeSize = EDGE_PX / zoom;
    const rotateOffset = ROTATE_OFFSET_PX / zoom;

    const cx = aabb.x + aabb.width / 2;
    const cy = aabb.y + aabb.height / 2;
    const left = aabb.x;
    const right = aabb.x + aabb.width;
    const top = aabb.y;
    const bottom = aabb.y + aabb.height;

    return [
        { id: 'corner-tl', x: left, y: top, size: cornerSize },
        { id: 'corner-tr', x: right, y: top, size: cornerSize },
        { id: 'corner-bl', x: left, y: bottom, size: cornerSize },
        { id: 'corner-br', x: right, y: bottom, size: cornerSize },
        { id: 'edge-t', x: cx, y: top, size: edgeSize },
        { id: 'edge-r', x: right, y: cy, size: edgeSize },
        { id: 'edge-b', x: cx, y: bottom, size: edgeSize },
        { id: 'edge-l', x: left, y: cy, size: edgeSize },
        { id: 'rotate', x: cx, y: top - rotateOffset, size: cornerSize },
        { id: 'pivot', x: cx, y: cy, size: cornerSize },
    ];
}

/** Draw all handles into `g`. Clears existing first. */
export function drawTransformHandles(g: Graphics, aabb: AABB, zoom: number): void {
    g.clear();
    const handles = computeHandleRects(aabb, zoom);
    const cx = aabb.x + aabb.width / 2;
    const top = aabb.y;
    const rotateOffset = ROTATE_OFFSET_PX / zoom;

    g.moveTo(cx, top).lineTo(cx, top - rotateOffset)
        .stroke({ color: COLOR, width: 1, alpha: 0.6 });

    for (const h of handles) {
        const half = h.size / 2;
        if (h.id === 'rotate') {
            g.circle(h.x, h.y, half).fill(COLOR).stroke({ color: COLOR, width: 1 });
            continue;
        }
        if (h.id === 'pivot') {
            g.moveTo(h.x - half, h.y).lineTo(h.x + half, h.y)
                .stroke({ color: COLOR, width: 1.5 });
            g.moveTo(h.x, h.y - half).lineTo(h.x, h.y + half)
                .stroke({ color: COLOR, width: 1.5 });
            continue;
        }
        g.rect(h.x - half, h.y - half, h.size, h.size)
            .fill(0xffffff)
            .stroke({ color: COLOR, width: 1 });
    }
}
