/**
 * Runtime-only state for items in flight during a drag gesture.
 *
 * The renderer composites EditorWorkingState + DragOverlay each tick: items
 * with overlay deltas render at offset positions while their original locations
 * paint as 20%-opacity ghosts. State is not mutated until pointerup, when a
 * single TransformCommand goes through the command stack.
 *
 * Part of the editor layer.
 */

export interface DragDelta {
    dx: number;
    dy: number;
    dRotation: number;
    scaleX: number;
    scaleY: number;
    /** World-space pivot for rotate/scale operations. Absent on move drags. */
    pivotX?: number;
    pivotY?: number;
}

type Listener = () => void;

export class DragOverlay {
    private deltas = new Map<string, DragDelta>();
    private listeners = new Set<Listener>();

    isActive(): boolean {
        return this.deltas.size > 0;
    }

    forGuid(guid: string): DragDelta | undefined {
        return this.deltas.get(guid);
    }

    setMany(guids: Iterable<string>, delta: DragDelta): void {
        this.deltas.clear();
        for (const g of guids) this.deltas.set(g, { ...delta });
        this.notify();
    }

    update(delta: Partial<DragDelta>): void {
        if (this.deltas.size === 0) return;
        for (const d of this.deltas.values()) Object.assign(d, delta);
        this.notify();
    }

    clear(): void {
        if (this.deltas.size === 0) return;
        this.deltas.clear();
        this.notify();
    }

    /** Iterate (guid, delta) pairs. */
    entries(): IterableIterator<[string, DragDelta]> {
        return this.deltas.entries();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const l of this.listeners) l();
    }
}
