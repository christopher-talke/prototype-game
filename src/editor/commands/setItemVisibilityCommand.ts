/**
 * Factory: toggle the `hidden` flag on an individual placement.
 * Composes multiplicatively with the layer-level `visible` flag: an item is
 * visible at render time iff its layer is visible AND the item's hidden flag
 * is falsy.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, setItemHidden } from './mapMutators';

/** Build a visibility-toggle command for a placement item. Returns null on unknown guid or no-op. */
export function buildSetItemVisibilityCommand(
    state: EditorWorkingState,
    guid: string,
    hidden: boolean,
): SnapshotCommand | null {
    if (!state.byGUID.has(guid)) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    setItemHidden(working, guid, hidden);
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, hidden ? 'Hide item' : 'Show item', false);
}
