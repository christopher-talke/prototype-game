/**
 * Factory: build a SnapshotCommand that patches one or more fields of
 * `MapData.meta`. Non-structural (does not create or delete items).
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';

/** Build a command that merges `patch` into `map.meta`. Returns null if no change. */
export function buildSetMapMetaCommand(
    state: EditorWorkingState,
    patch: Partial<MapData['meta']>,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;
    Object.assign(working.meta, patch);
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, 'Edit map properties', false);
}
