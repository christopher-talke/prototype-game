/**
 * Factory: toggle the `locked` flag on an individual placement.
 * Locked items are not pickable via the renderer's hit-test and cannot be
 * mutated by transform handles, mirroring the layer-level lock behaviour.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, setItemLocked } from './mapMutators';

/** Build a lock-toggle command for a placement item. Returns null on unknown guid or no-op. */
export function buildSetItemLockCommand(
    state: EditorWorkingState,
    guid: string,
    locked: boolean,
): SnapshotCommand | null {
    if (!state.byGUID.has(guid)) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    setItemLocked(working, guid, locked);
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, locked ? 'Lock item' : 'Unlock item', false);
}
