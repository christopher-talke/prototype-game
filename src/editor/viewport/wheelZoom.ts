/**
 * Cursor-anchored scroll-wheel zoom.
 *
 * Delegates to `camera.zoomAt(screenX, screenY, factor)` which preserves the
 * world point under the cursor across zoom changes. Wheel delta is mapped
 * exponentially so zooming feels linear across the full range.
 *
 * Part of the editor layer.
 */

import type { EditorCamera } from './EditorCamera';

const ZOOM_BASE = 1.0015;

export class WheelZoom {
    constructor(
        private readonly target: HTMLElement,
        private readonly camera: EditorCamera,
    ) {
        target.addEventListener('wheel', this.onWheel, { passive: false });
    }

    private onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = this.target.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = Math.pow(ZOOM_BASE, -e.deltaY);
        this.camera.zoomAt(sx, sy, factor);
    };
}
