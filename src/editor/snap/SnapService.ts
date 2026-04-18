/**
 * Snap service.
 *
 * Phase 1 ships only the sticky toggle (bound to Ctrl+G). When enabled,
 * `snapToGrid` rounds to the nearest multiple of `resolution`. Toggling is
 * persisted in the editor state so it survives reloads.
 *
 * Listeners can subscribe to snap events to drive the visual indicator.
 *
 * Part of the editor layer.
 */

type Listener = (x: number, y: number) => void;

export class SnapService {
    private enabled = false;
    private resolution = 8;
    private listeners: Set<Listener> = new Set();
    private changeListeners: Set<() => void> = new Set();

    setEnabled(v: boolean): void {
        if (this.enabled === v) return;
        this.enabled = v;
        for (const l of this.changeListeners) l();
    }

    toggle(): void {
        this.setEnabled(!this.enabled);
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setResolution(r: number): void {
        this.resolution = Math.max(1, r);
    }

    getResolution(): number {
        return this.resolution;
    }

    /** Snap `(x, y)` to the grid when enabled, emitting a snap event for the indicator. */
    snapToGrid(x: number, y: number): { x: number; y: number } {
        if (!this.enabled) return { x, y };
        const r = this.resolution;
        const sx = Math.round(x / r) * r;
        const sy = Math.round(y / r) * r;
        for (const l of this.listeners) l(sx, sy);
        return { x: sx, y: sy };
    }

    onSnap(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    onChange(listener: () => void): () => void {
        this.changeListeners.add(listener);
        return () => this.changeListeners.delete(listener);
    }
}
