/**
 * Editor camera. Free pan + cursor-anchored zoom.
 *
 * State `{ x, y, zoom }` in world coordinates. World<->screen conversions
 * live here and are called by every tool, gizmo, and overlay. Zoom clamps
 * to [0.05, 32].
 *
 * Cursor-anchored zoom keeps the world point under the cursor fixed across
 * zoom changes; that is the standard expected behaviour and its formula is
 * not negotiable.
 *
 * Per-floor storage lives in the `EditorStateStore` -- this camera just
 * maintains the current view.
 *
 * Part of the editor layer.
 */

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export interface CameraState {
    x: number;
    y: number;
    zoom: number;
}

type Listener = () => void;

export class EditorCamera {
    private viewportWidth = 1;
    private viewportHeight = 1;
    x = 0;
    y = 0;
    zoom = 1;
    private listeners: Set<Listener> = new Set();

    /** Update the viewport size in CSS pixels. Call on resize. */
    setViewportSize(w: number, h: number): void {
        this.viewportWidth = Math.max(1, w);
        this.viewportHeight = Math.max(1, h);
        this.notify();
    }

    getViewportSize(): { width: number; height: number } {
        return { width: this.viewportWidth, height: this.viewportHeight };
    }

    /** Snapshot the current camera. */
    snapshot(): CameraState {
        return { x: this.x, y: this.y, zoom: this.zoom };
    }

    /** Restore a previously snapshot camera. */
    restore(state: CameraState): void {
        this.x = state.x;
        this.y = state.y;
        this.zoom = clampZoom(state.zoom);
        this.notify();
    }

    /** Centre the view on a world point, preserving zoom. */
    centerOn(worldX: number, worldY: number): void {
        this.x = worldX - this.viewportWidth / 2 / this.zoom;
        this.y = worldY - this.viewportHeight / 2 / this.zoom;
        this.notify();
    }

    /** Translate the camera by screen-pixel delta (inverse-zoomed to world). */
    panByScreen(dxScreen: number, dyScreen: number): void {
        this.x -= dxScreen / this.zoom;
        this.y -= dyScreen / this.zoom;
        this.notify();
    }

    /**
     * Cursor-anchored zoom. Applies a multiplicative zoom factor while keeping
     * the world point under `(screenX, screenY)` invariant on screen.
     */
    zoomAt(screenX: number, screenY: number, factor: number): void {
        const before = this.screenToWorld(screenX, screenY);
        this.zoom = clampZoom(this.zoom * factor);
        const after = this.screenToWorld(screenX, screenY);
        this.x += before.x - after.x;
        this.y += before.y - after.y;
        this.notify();
    }

    /** Convert a screen-pixel point to world coordinates. */
    screenToWorld(sx: number, sy: number): { x: number; y: number } {
        return { x: sx / this.zoom + this.x, y: sy / this.zoom + this.y };
    }

    /** Convert a world point to screen pixels. */
    worldToScreen(wx: number, wy: number): { x: number; y: number } {
        return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom };
    }

    /** Subscribe to camera changes. Returns unsubscribe. */
    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const l of this.listeners) l();
    }
}

function clampZoom(z: number): number {
    if (z < MIN_ZOOM) return MIN_ZOOM;
    if (z > MAX_ZOOM) return MAX_ZOOM;
    return z;
}

export { MIN_ZOOM, MAX_ZOOM };
