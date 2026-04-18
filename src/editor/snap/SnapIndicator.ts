/**
 * Cyan-crosshair snap indicator. Fades out over 200 ms.
 *
 * Rendered in world coordinates inside `overlayLayer`. Any caller of
 * `SnapService.snapToGrid` triggers a fade -- Phase 1 has no tools that
 * consume snap yet, so the indicator is effectively dormant but wired.
 *
 * Part of the editor layer.
 */

import { type Container, Graphics } from 'pixi.js';

import type { EditorCamera } from '../viewport/EditorCamera';
import type { SnapService } from './SnapService';

const FADE_MS = 200;
const SIZE_PX = 8;
const COLOR = 0x00e5ff;

export class SnapIndicator {
    private graphics: Graphics;
    private lastTrigger = 0;
    private redrawScheduled = false;

    constructor(
        parent: Container,
        snap: SnapService,
        private readonly camera: EditorCamera,
    ) {
        this.graphics = new Graphics();
        this.graphics.alpha = 0;
        parent.addChild(this.graphics);

        snap.onSnap((x, y) => {
            this.graphics.position.set(x, y);
            this.lastTrigger = performance.now();
            this.draw();
            if (!this.redrawScheduled) {
                this.redrawScheduled = true;
                requestAnimationFrame(this.animate);
            }
        });
    }

    private animate = () => {
        const elapsed = performance.now() - this.lastTrigger;
        const t = Math.min(1, elapsed / FADE_MS);
        this.graphics.alpha = 1 - t;
        if (t < 1) {
            requestAnimationFrame(this.animate);
        } else {
            this.redrawScheduled = false;
            this.graphics.alpha = 0;
        }
    };

    private draw(): void {
        const g = this.graphics;
        g.clear();
        const half = SIZE_PX / this.camera.zoom;
        const thick = 1 / this.camera.zoom;
        g.moveTo(-half, 0).lineTo(half, 0);
        g.moveTo(0, -half).lineTo(0, half);
        g.stroke({ width: thick, color: COLOR, alpha: 1 });
    }
}
