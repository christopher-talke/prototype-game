/**
 * Per-kind recent-N tracker for the object/entity palettes.
 *
 * Backed by `EditorStatePersisted.paletteRecents`; updates are exposed through
 * a small API the EditorApp wires to its persist function. Capped at 8.
 *
 * Part of the editor layer.
 */

import type { PaletteRecents } from '../persistence/editorStatePersistence';

const MAX_RECENTS = 8;

/** Record `defId` as the most recently used entry for `kind`. Mutates `recents`. */
export function markUsed(recents: PaletteRecents, kind: 'object' | 'entity', defId: string): void {
    const list = recents[kind];
    const idx = list.indexOf(defId);
    if (idx !== -1) list.splice(idx, 1);
    list.unshift(defId);
    if (list.length > MAX_RECENTS) list.length = MAX_RECENTS;
}

/** Return the recent-list slice for the kind. */
export function getRecents(recents: PaletteRecents, kind: 'object' | 'entity'): string[] {
    return [...recents[kind]];
}
