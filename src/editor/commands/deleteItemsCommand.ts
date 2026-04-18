/**
 * Factory: build a SnapshotCommand that removes a batch of items by guid.
 * Structural -- triggers immediate auto-save.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, deleteItems } from './mapMutators';

export function buildDeleteItemsCommand(
    state: EditorWorkingState,
    guids: string[],
): SnapshotCommand | null {
    if (guids.length === 0) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    deleteItems(working, guids);
    const after = JSON.stringify(working);
    if (after === before) return null;
    const desc = guids.length === 1 ? 'Delete item' : `Delete ${guids.length} items`;
    return new SnapshotCommand(before, after, desc, true);
}
