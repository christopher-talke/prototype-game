/**
 * Factory: build a SnapshotCommand that sets `path` to `value` on the item
 * identified by `guid`. Non-structural.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, setProperty } from './mapMutators';

/** Build a SnapshotCommand that updates a single property. Returns null if no change. */
export function buildSetPropertyCommand(
    state: EditorWorkingState,
    guid: string,
    path: string[],
    value: unknown,
    description?: string,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    setProperty(working, guid, path, value);
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, description ?? `Set ${path.join('.')}`, false);
}
