/**
 * Factory: build a SnapshotCommand that appends a new Floor to
 * `map.floors` with a default empty collision layer. Structural.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { newGuid } from '../guid/idFactory';
import { SnapshotCommand } from './SnapshotCommand';

/** Build a command that adds a new floor with `label`. */
export function buildAddFloorCommand(
    state: EditorWorkingState,
    label: string,
): SnapshotCommand {
    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;

    const floorId = newGuid();
    const nextOrder = working.floors.reduce((max, f) => Math.max(max, f.renderOrder), -1) + 1;
    working.floors.push({ id: floorId, label, renderOrder: nextOrder });

    working.layers.push({
        id: newGuid(),
        floorId,
        type: 'collision',
        label: 'Collision',
        locked: false,
        visible: true,
        walls: [],
        objects: [],
        entities: [],
        decals: [],
        lights: [],
    });

    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, `Add floor '${label}'`, true);
}
