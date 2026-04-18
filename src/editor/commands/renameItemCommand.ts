/**
 * Factory: rename an item via its display-name field. Non-structural.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, setItemName } from './mapMutators';

export function buildRenameItemCommand(
    state: EditorWorkingState,
    guid: string,
    name: string,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    setItemName(working, guid, name);
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, 'Rename item', false);
}
