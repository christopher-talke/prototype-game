/**
 * Selection state for the editor.
 *
 * Selection lives outside MapData (per architecture) -- it is editor-only,
 * persisted to IndexedDB rather than the map file, and never passes through
 * the command stack. Listeners are notified on every change for UI/render
 * sync.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';

export type SelectionListener = () => void;

export class SelectionStore {
    private selected = new Set<string>();
    private hovered: string | null = null;
    private listeners = new Set<SelectionListener>();

    has(guid: string): boolean {
        return this.selected.has(guid);
    }

    isOnly(guid: string): boolean {
        return this.selected.size === 1 && this.selected.has(guid);
    }

    isEmpty(): boolean {
        return this.selected.size === 0;
    }

    size(): number {
        return this.selected.size;
    }

    selectedArray(): string[] {
        return Array.from(this.selected);
    }

    hover(): string | null {
        return this.hovered;
    }

    /** Replace selection with a single GUID, or extend the selection if `additive`. */
    select(guid: string, additive = false): void {
        if (!additive) this.selected.clear();
        this.selected.add(guid);
        this.notify();
    }

    /** Replace selection with the given GUIDs (or extend if `additive`). */
    selectMany(guids: Iterable<string>, additive = false): void {
        if (!additive) this.selected.clear();
        for (const g of guids) this.selected.add(g);
        this.notify();
    }

    /** Toggle a single GUID in/out of the selection. */
    toggle(guid: string): void {
        if (this.selected.has(guid)) this.selected.delete(guid);
        else this.selected.add(guid);
        this.notify();
    }

    /** Remove a GUID from the selection. */
    deselect(guid: string): void {
        if (this.selected.delete(guid)) this.notify();
    }

    clear(): void {
        if (this.selected.size === 0) return;
        this.selected.clear();
        this.notify();
    }

    setHover(guid: string | null): void {
        if (this.hovered === guid) return;
        this.hovered = guid;
        this.notify();
    }

    /** Drop any GUIDs that no longer exist in `state.byGUID`. Call after undo/redo. */
    pruneAgainst(state: EditorWorkingState): void {
        let changed = false;
        for (const guid of this.selected) {
            if (!state.byGUID.has(guid)) {
                this.selected.delete(guid);
                changed = true;
            }
        }
        if (this.hovered && !state.byGUID.has(this.hovered)) {
            this.hovered = null;
            changed = true;
        }
        if (changed) this.notify();
    }

    subscribe(listener: SelectionListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const l of this.listeners) l();
    }
}
