/**
 * Double-click detector for the editor viewport.
 *
 * Click count is native to browser pointer events but PointerEvent.detail
 * resets on any intervening event. This tracker compares two pointerdown
 * events by time (<=300 ms) and screen distance (<=4 px). It is shared
 * infrastructure for group-enter (click-on-member) and vertex-edit
 * (double-click-polygon).
 *
 * Part of the editor layer.
 */

const DOUBLE_CLICK_MS = 300;
const DOUBLE_CLICK_PX = 4;

export class DoubleClickTracker {
    private lastTime = 0;
    private lastX = 0;
    private lastY = 0;

    /** Record a pointerdown. Returns true if this one completes a double-click. */
    record(screenX: number, screenY: number, timeMs: number = performance.now()): boolean {
        const dt = timeMs - this.lastTime;
        const dx = screenX - this.lastX;
        const dy = screenY - this.lastY;
        const hit = dt <= DOUBLE_CLICK_MS && Math.hypot(dx, dy) <= DOUBLE_CLICK_PX;
        if (hit) {
            this.lastTime = 0;
            return true;
        }
        this.lastTime = timeMs;
        this.lastX = screenX;
        this.lastY = screenY;
        return false;
    }

    reset(): void {
        this.lastTime = 0;
    }
}
