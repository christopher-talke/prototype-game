/**
 * Screen-fixed zoom level + snap state indicator in the bottom-right corner.
 *
 * Subscribes to EditorCamera and SnapService; updates a DOM label showing
 * zoom percentage and current snap state. Clicking resets zoom to 100%.
 *
 * Part of the editor layer.
 */

import type { EditorCamera } from './EditorCamera';
import type { SnapService } from '../snap/SnapService';

export class ZoomIndicator {
    private readonly el: HTMLElement;
    private readonly unsubs: (() => void)[];

    constructor(parent: HTMLElement, camera: EditorCamera, snap: SnapService, onResetZoom: () => void) {
        this.el = document.createElement('div');
        this.el.className = 'editor-zoom-indicator';
        this.el.title = 'Click to reset zoom to 100% (Ctrl+1)';
        this.el.addEventListener('click', onResetZoom);
        parent.appendChild(this.el);

        const refresh = () => this.update(camera, snap);
        this.unsubs = [
            camera.subscribe(refresh),
            snap.onChange(refresh),
        ];
        refresh();
    }

    destroy(): void {
        for (const u of this.unsubs) u();
        this.el.remove();
    }

    private update(camera: EditorCamera, snap: SnapService): void {
        const zoomPct = `${Math.round(camera.zoom * 100)}%`;
        const snapLabel = snap.isEnabled() ? `Snap ${snap.getResolution()}` : 'Snap off';
        this.el.textContent = `${zoomPct}  |  ${snapLabel}`;
    }
}
