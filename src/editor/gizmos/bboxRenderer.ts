/**
 * Draws a selection bounding box into a Graphics: solid 1px cyan @60% for
 * a single selection, dashed for multi-selection, muted white @20% for
 * locked-layer selections.
 *
 * Part of the editor layer.
 */

import type { Graphics } from 'pixi.js';

import type { AABB } from '../selection/boundsOf';

const SOLID_COLOR = 0x00e5ff;
const SOLID_ALPHA = 0.6;
const HOVER_ALPHA = 0.2;
const MUTED_COLOR = 0xffffff;
const MUTED_ALPHA = 0.2;
const MEMBER_ALPHA = 0.3;
const DASH = 4;
const GAP = 4;

export interface BBoxStyle {
    /** 'single', 'multi', 'hover', 'locked', 'member' */
    kind: 'single' | 'multi' | 'hover' | 'locked' | 'member';
}

/**
 * Draw `aabb` into `g` using the appropriate visual for `style`.
 * Pass `clear = false` when accumulating multiple boxes into one Graphics.
 */
export function drawSelectionBBox(g: Graphics, aabb: AABB, style: BBoxStyle, clear = true): void {
    if (clear) g.clear();
    if (aabb.width <= 0 || aabb.height <= 0) return;

    if (style.kind === 'member') {
        g.rect(aabb.x, aabb.y, aabb.width, aabb.height)
            .stroke({ color: SOLID_COLOR, width: 1, alpha: MEMBER_ALPHA });
        return;
    }
    if (style.kind === 'locked') {
        g.rect(aabb.x, aabb.y, aabb.width, aabb.height)
            .stroke({ color: MUTED_COLOR, width: 1, alpha: MUTED_ALPHA });
        return;
    }
    if (style.kind === 'hover') {
        g.rect(aabb.x, aabb.y, aabb.width, aabb.height)
            .stroke({ color: SOLID_COLOR, width: 1, alpha: HOVER_ALPHA });
        return;
    }
    if (style.kind === 'multi') {
        drawDashedRect(g, aabb);
        return;
    }
    g.rect(aabb.x, aabb.y, aabb.width, aabb.height)
        .stroke({ color: SOLID_COLOR, width: 1, alpha: SOLID_ALPHA });
}

function drawDashedRect(g: Graphics, aabb: AABB): void {
    const { x, y, width, height } = aabb;
    drawDashedSegment(g, x, y, x + width, y);
    drawDashedSegment(g, x + width, y, x + width, y + height);
    drawDashedSegment(g, x + width, y + height, x, y + height);
    drawDashedSegment(g, x, y + height, x, y);
}

function drawDashedSegment(g: Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const ux = dx / length;
    const uy = dy / length;
    let drawn = 0;
    while (drawn < length) {
        const segLen = Math.min(DASH, length - drawn);
        const sx = x1 + ux * drawn;
        const sy = y1 + uy * drawn;
        const ex = sx + ux * segLen;
        const ey = sy + uy * segLen;
        g.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: SOLID_COLOR, width: 1, alpha: SOLID_ALPHA });
        drawn += segLen + GAP;
    }
}
