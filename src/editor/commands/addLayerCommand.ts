/**
 * Factory: build a SnapshotCommand that appends a new `object` layer to
 * `floorId`. Returns the layer's generated GUID out-of-band so the caller
 * can mark it active and begin inline rename. Structural.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { newGuid } from '../guid/idFactory';
import { SnapshotCommand } from './SnapshotCommand';

export interface AddLayerResult {
    command: SnapshotCommand;
    layerId: string;
}

/** Build a command that adds a new object-type layer on `floorId`. Null when floor is unknown. */
export function buildAddLayerCommand(
    state: EditorWorkingState,
    floorId: string,
    label: string,
): AddLayerResult | null {
    if (!state.map.floors.some((f) => f.id === floorId)) return null;

    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;

    const layerId = newGuid();
    working.layers.push({
        id: layerId,
        floorId,
        type: 'object',
        label,
        locked: false,
        visible: true,
        walls: [],
        objects: [],
        entities: [],
        decals: [],
        lights: [],
    });

    const after = JSON.stringify(working);
    return {
        command: new SnapshotCommand(before, after, `Add layer '${label}'`, true),
        layerId,
    };
}
