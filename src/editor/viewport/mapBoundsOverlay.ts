/**
 * Draws a visual boundary for the map in the editor viewport.
 *
 * Renders four darkened strips outside the map bounds so the playable area
 * is clearly delimited, plus a bright 2px border line along the map edge.
 * Lives in `backgroundLayer` above the grid.
 *
 * Redraws only when bounds or zoom changes. Bounds origin is always (0, 0).
 *
 * Part of the editor layer.
 */

import { Graphics, type Container } from 'pixi.js';

import type { EditorCamera } from './EditorCamera';
import type { EditorWorkingState } from '../state/EditorWorkingState';

/** World-unit extent of the outside strips — covers any viewport at minimum zoom. */
const OUTSIDE_EXT = 60000;
const OUTSIDE_COLOR = 0x000000;
const OUTSIDE_ALPHA = 0.45;
const BORDER_COLOR = 0xffffff;
const BORDER_ALPHA = 0.55;

export class MapBoundsOverlay {
    private readonly g: Graphics;
    private lastKey = '';

    constructor(
        parent: Container,
        private readonly state: EditorWorkingState,
        private readonly camera: EditorCamera,
    ) {
        this.g = new Graphics();
        this.g.label = 'editor.mapBounds';
        parent.addChild(this.g);
    }

    update(): void {
        const { width, height } = this.state.map.bounds;
        const zoom = this.camera.zoom;
        const key = `${width},${height},${zoom.toFixed(4)}`;
        if (key === this.lastKey) return;
        this.lastKey = key;
        this.redraw(width, height, zoom);
    }

    private redraw(w: number, h: number, zoom: number): void {
        const g = this.g;
        g.clear();

        const e = OUTSIDE_EXT;

        // Outside strips (top, bottom, left, right)
        g.rect(-e, -e, w + 2 * e, e).fill({ color: OUTSIDE_COLOR, alpha: OUTSIDE_ALPHA });
        g.rect(-e, h, w + 2 * e, e).fill({ color: OUTSIDE_COLOR, alpha: OUTSIDE_ALPHA });
        g.rect(-e, 0, e, h).fill({ color: OUTSIDE_COLOR, alpha: OUTSIDE_ALPHA });
        g.rect(w, 0, e, h).fill({ color: OUTSIDE_COLOR, alpha: OUTSIDE_ALPHA });

        // Border — constant 2 screen pixels regardless of zoom
        const lineW = 2 / zoom;
        g.rect(0, 0, w, h).stroke({ width: lineW, color: BORDER_COLOR, alpha: BORDER_ALPHA });
    }
}
