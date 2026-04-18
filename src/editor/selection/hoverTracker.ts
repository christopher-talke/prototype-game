/**
 * Maps pointer-move events to "is the cursor over a selectable item on the
 * active layer?" -- delegates the geometric check to a hit-test function
 * supplied by the caller (typically `editorMapRenderer.hitTest`).
 *
 * Owns no state beyond the most recently reported hover GUID; updates the
 * SelectionStore's hover field on change.
 *
 * Part of the editor layer.
 */

import type { SelectionStore } from './selectionStore';

export type HoverHitTest = (worldX: number, worldY: number) => string | null;

export class HoverTracker {
    constructor(
        private readonly selection: SelectionStore,
        private readonly hitTest: HoverHitTest,
    ) {}

    /** Inform the tracker the pointer is at the given world coords. */
    update(worldX: number, worldY: number): void {
        const guid = this.hitTest(worldX, worldY);
        this.selection.setHover(guid);
    }

    /** Inform the tracker the pointer left the viewport / is no longer relevant. */
    clear(): void {
        this.selection.setHover(null);
    }
}
