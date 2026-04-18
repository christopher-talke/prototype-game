/**
 * Factory: apply the same property set to multiple GUIDs in a single
 * SnapshotCommand. Used by the multi-select form for shared-field edits
 * (e.g. wallType across N walls) so undo rewinds all at once.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { cloneMapData, setProperty } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

/**
 * Build a command that writes `value` to `path` on every `guid`.
 * Returns null if no mutation actually changed the map (all skipped).
 */
export function buildBatchSetPropertyCommand(
    state: EditorWorkingState,
    guids: string[],
    path: string[],
    value: unknown,
    description?: string,
): SnapshotCommand | null {
    if (guids.length === 0) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    for (const g of guids) {
        setProperty(working, g, path, value);
    }
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, description ?? `Set ${path.join('.')} (${guids.length})`, false);
}
