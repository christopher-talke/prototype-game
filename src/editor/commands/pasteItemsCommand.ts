/**
 * Factory: paste the current clipboard payload at the supplied world point.
 * Allocates new GUIDs + display names for each pasted item. Structural.
 *
 * Returns both the SnapshotCommand and the new GUIDs (so callers can update
 * the selection to the new items).
 *
 * Part of the editor layer.
 */

import type { Vec2 } from '@shared/map/MapData';

import type { EditorWorkingState, ItemKind } from '../state/EditorWorkingState';
import { applyClipboardPaste, readClipboard } from '../clipboard/clipboard';
import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData } from './mapMutators';

export interface PasteResult {
    command: SnapshotCommand;
    newGuids: string[];
}

/** Build a paste command from the current clipboard. Returns null if clipboard empty. */
export function buildPasteItemsCommand(
    state: EditorWorkingState,
    targetCentre: Vec2,
): PasteResult | null {
    const payload = readClipboard();
    if (!payload || payload.items.length === 0) return null;
    if (!state.activeLayerId) return null;

    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const tempCounters = new Map(state.counters);
    const allocator = (kind: ItemKind) => nextDisplayName(tempCounters, kind);
    const newGuids = applyClipboardPaste(
        working,
        payload.items,
        targetCentre,
        state.activeLayerId,
        allocator,
        newGuid,
    );
    if (newGuids.length === 0) return null;
    const after = JSON.stringify(working);
    const desc = newGuids.length === 1 ? 'Paste item' : `Paste ${newGuids.length} items`;
    return { command: new SnapshotCommand(before, after, desc, true), newGuids };
}
