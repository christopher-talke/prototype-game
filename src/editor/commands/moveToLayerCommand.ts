/**
 * Factory: move a batch of items between layers (must be the same floor for
 * the move to make sense). Structural.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, moveItemsToLayer } from './mapMutators';

export function buildMoveToLayerCommand(
    state: EditorWorkingState,
    guids: string[],
    targetLayerId: string,
): SnapshotCommand | null {
    if (guids.length === 0) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    moveItemsToLayer(working, guids, targetLayerId);
    const after = JSON.stringify(working);
    if (after === before) return null;
    const desc = guids.length === 1 ? 'Move item to layer' : `Move ${guids.length} items to layer`;
    return new SnapshotCommand(before, after, desc, true);
}
