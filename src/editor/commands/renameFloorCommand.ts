/**
 * Factory: rename a floor's label. Structural.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';

export function buildRenameFloorCommand(
    state: EditorWorkingState,
    floorId: string,
    label: string,
): SnapshotCommand | null {
    const floor = state.map.floors.find((f) => f.id === floorId);
    if (!floor) return null;
    if (floor.label === label) return null;

    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;
    const target = working.floors.find((f) => f.id === floorId);
    if (!target) return null;
    target.label = label;

    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, `Rename floor to '${label}'`, true);
}
