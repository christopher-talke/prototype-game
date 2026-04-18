/**
 * Factory: duplicate the supplied items at the same position with a small
 * offset. Allocates new GUIDs + display names. Does not touch the clipboard.
 * Structural.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState, ItemKind } from '../state/EditorWorkingState';
import { applyClipboardPaste } from '../clipboard/clipboard';
import { unionBounds } from '../selection/boundsOf';
import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData } from './mapMutators';
import type { SerializedItem } from '../clipboard/serializedItem';
import { copyToClipboard, readClipboard, restoreClipboard } from '../clipboard/clipboard';
import type { SnapService } from '../snap/SnapService';

export interface DuplicateResult {
    command: SnapshotCommand;
    newGuids: string[];
}

const DUPLICATE_OFFSET = 16;

export function buildDuplicateItemsCommand(
    state: EditorWorkingState,
    guids: string[],
    snap: SnapService,
): DuplicateResult | null {
    if (guids.length === 0) return null;
    if (!state.activeLayerId) return null;

    const aabb = unionBounds(state, guids);
    const sourceCentre = { x: aabb.x + aabb.width / 2, y: aabb.y + aabb.height / 2 };

    const stash = readClipboard();
    copyToClipboard(state, guids);
    const fresh = readClipboard();
    const items: SerializedItem[] = fresh ? fresh.items.map((i) => ({ ...i })) : [];
    restoreClipboard(stash);
    if (items.length === 0) return null;

    const rawTarget = {
        x: sourceCentre.x + DUPLICATE_OFFSET,
        y: sourceCentre.y + DUPLICATE_OFFSET,
    };
    const targetCentre = snap.snapToGrid(rawTarget.x, rawTarget.y);

    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const tempCounters = new Map(state.counters);
    const allocator = (kind: ItemKind) => nextDisplayName(tempCounters, kind);
    const newGuids = applyClipboardPaste(
        working,
        items,
        targetCentre,
        state.activeLayerId,
        allocator,
        newGuid,
    );
    if (newGuids.length === 0) return null;
    const after = JSON.stringify(working);
    const desc = newGuids.length === 1 ? 'Duplicate item' : `Duplicate ${newGuids.length} items`;
    return { command: new SnapshotCommand(before, after, desc, true), newGuids };
}
