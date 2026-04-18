/**
 * Factory: copy the supplied items to the clipboard AND remove them from the
 * map in a single command. Undo restores them at their original GUIDs (because
 * SnapshotCommand restores the full pre-cut MapData verbatim).
 *
 * Structural.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { copyToClipboard } from '../clipboard/clipboard';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, deleteItems } from './mapMutators';

export function buildCutItemsCommand(
    state: EditorWorkingState,
    guids: string[],
): SnapshotCommand | null {
    if (guids.length === 0) return null;

    copyToClipboard(state, guids);

    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    deleteItems(working, guids);
    const after = JSON.stringify(working);
    if (after === before) return null;
    const desc = guids.length === 1 ? 'Cut item' : `Cut ${guids.length} items`;
    return new SnapshotCommand(before, after, desc, true);
}
