/**
 * Factory: build a SnapshotCommand that removes a Floor plus all of its
 * layers (and items within) and all zones on that floor. Structural.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';

/** Build a command that removes the floor with the given ID. Returns null if not found
 * or if it is the only remaining floor. */
export function buildRemoveFloorCommand(
    state: EditorWorkingState,
    floorId: string,
): SnapshotCommand | null {
    const idx = state.map.floors.findIndex((f) => f.id === floorId);
    if (idx === -1) return null;
    if (state.map.floors.length <= 1) return null;

    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;

    const label = working.floors[idx].label;
    working.floors.splice(idx, 1);
    working.layers = working.layers.filter((l) => l.floorId !== floorId);
    working.zones = working.zones.filter((z) => z.floorId !== floorId);

    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, `Remove floor '${label}'`, true);
}
