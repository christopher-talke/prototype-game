/**
 * Factory: build a SnapshotCommand that moves a guid within its backing array.
 *
 * Handles the map-data side of drag-reorder: layer reorder within a floor,
 * root-level item reorder within a layer's kind array (walls/objects/etc.),
 * zone reorder on a single floor, nav-hint reorder. Group memberIds moves are
 * handled by `moveMemberCommand.ts` instead.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, reorderItem, type ReorderPosition } from './mapMutators';

export type { ReorderPosition };

/**
 * Build a reorder command. Returns null when:
 *  - either guid is unknown,
 *  - the two guids live in different backing arrays,
 *  - the reorder is a no-op.
 */
export function buildReorderItemCommand(
    state: EditorWorkingState,
    movingGuid: string,
    targetGuid: string,
    position: ReorderPosition,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const changed = reorderItem(working, movingGuid, targetGuid, position);
    if (!changed) return null;
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, 'Reorder', false);
}
