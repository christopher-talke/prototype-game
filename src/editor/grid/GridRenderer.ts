/**
 * Snap-aligned adaptive grid. Minor lines are always at multiples of the
 * SnapService resolution; the displayed unit doubles as you zoom out to
 * keep line density readable. Minor lines fade in/out smoothly around the
 * density threshold so there is no hard pop.
 *
 * Part of the editor layer.
 */

import { Container, Graphics } from 'pixi.js';

import type { EditorCamera } from '../viewport/EditorCamera';
import type { SnapService } from '../snap/SnapService';
import { GRID_LINE_PX, GRID_MAJOR_COLOR, GRID_MINOR_COLOR, MAJOR_EVERY } from './gridConfig';

interface LastDraw {
    minor: number;
    major: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

/** Minimum screen pixels between minor grid lines before the unit doubles. */
const MIN_MINOR_PX = 8;
/** Minor lines fully opaque above this many screen pixels spacing. */
const FADE_MINOR_PX = 20;

export class GridRenderer {
    private container: Container;
    private minorG = new Graphics();
    private majorG = new Graphics();
    private visible = true;
    private last: LastDraw | null = null;
    private lastSnap = 0;

    constructor(parent: Container, private readonly camera: EditorCamera, private readonly snap: SnapService) {
        this.container = new Container();
        this.container.label = 'editor.grid';
        this.container.addChild(this.minorG);
        this.container.addChild(this.majorG);
        parent.addChild(this.container);
    }

    setVisible(v: boolean): void {
        this.visible = v;
        this.container.visible = v;
    }

    isVisible(): boolean {
        return this.visible;
    }

    /** Called each frame. */
    update(): void {
        if (!this.visible) return;

        const snapRes = this.snap.getResolution();
        const zoom = this.camera.zoom;
        const { width, height } = this.camera.getViewportSize();
        const worldX0 = this.camera.x;
        const worldY0 = this.camera.y;
        const worldX1 = worldX0 + width / zoom;
        const worldY1 = worldY0 + height / zoom;

        const { minor, major, minorAlpha } = computeUnits(snapRes, zoom);

        this.minorG.alpha = minorAlpha * 0.6;
        this.majorG.alpha = 1;

        const snapChanged = snapRes !== this.lastSnap;
        if (snapChanged) this.last = null;
        this.lastSnap = snapRes;

        if (this.needsRedraw(minor, major, worldX0, worldY0, worldX1, worldY1)) {
            const pad = major;
            const x0 = Math.floor((worldX0 - pad) / minor) * minor;
            const y0 = Math.floor((worldY0 - pad) / minor) * minor;
            const x1 = Math.ceil((worldX1 + pad) / minor) * minor;
            const y1 = Math.ceil((worldY1 + pad) / minor) * minor;

            drawGrid(this.minorG, this.majorG, minor, major, x0, y0, x1, y1, zoom);
            this.last = { minor, major, x0, y0, x1, y1 };
        }
    }

    private needsRedraw(minor: number, major: number, wx0: number, wy0: number, wx1: number, wy1: number): boolean {
        if (!this.last) return true;
        if (this.last.minor !== minor || this.last.major !== major) return true;
        const e = this.last;
        return wx0 < e.x0 || wy0 < e.y0 || wx1 > e.x1 || wy1 > e.y1;
    }
}

/**
 * Compute grid units for the current zoom and snap resolution.
 * Minor unit is the smallest power-of-2 multiple of snapRes where
 * lines are >= MIN_MINOR_PX apart on screen.
 */
function computeUnits(snapRes: number, zoom: number): { minor: number; major: number; minorAlpha: number } {
    let minor = snapRes;
    while (minor * zoom < MIN_MINOR_PX) minor *= 2;

    const major = minor * MAJOR_EVERY;

    const minorPx = minor * zoom;
    const minorAlpha = Math.min(1, (minorPx - MIN_MINOR_PX) / (FADE_MINOR_PX - MIN_MINOR_PX));

    return { minor, major, minorAlpha };
}

function drawGrid(
    minorG: Graphics,
    majorG: Graphics,
    minor: number,
    major: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    zoom: number,
): void {
    minorG.clear();
    majorG.clear();

    const lineWorld = GRID_LINE_PX / zoom;

    for (let x = x0; x <= x1; x += minor) {
        const isMajor = Math.round(x / major) * major === Math.round(x);
        if (isMajor) continue;
        minorG.moveTo(x, y0).lineTo(x, y1);
    }
    for (let y = y0; y <= y1; y += minor) {
        const isMajor = Math.round(y / major) * major === Math.round(y);
        if (isMajor) continue;
        minorG.moveTo(x0, y).lineTo(x1, y);
    }
    minorG.stroke({ width: lineWorld, color: GRID_MINOR_COLOR, alpha: 1 });

    for (let x = Math.round(x0 / major) * major; x <= x1; x += major) {
        majorG.moveTo(x, y0).lineTo(x, y1);
    }
    for (let y = Math.round(y0 / major) * major; y <= y1; y += major) {
        majorG.moveTo(x0, y).lineTo(x1, y);
    }
    majorG.stroke({ width: lineWorld, color: GRID_MAJOR_COLOR, alpha: 1 });
}
