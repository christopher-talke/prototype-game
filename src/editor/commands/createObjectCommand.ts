/**
 * Factory: create a new ObjectPlacement on the given layer. Structural.
 *
 * Allocates GUID + display name, appends to `layer.objects`. Object def must
 * exist in `map.objectDefs`.
 *
 * Part of the editor layer.
 */

import type { ObjectPlacement, Vec2 } from '@shared/map/MapData';

import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { cloneMapData } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

export interface CreateObjectResult {
    command: SnapshotCommand;
    newGuid: string;
}

/**
 * Build a command that appends a new ObjectPlacement to `layerId`.
 * Returns null if the layer or object def do not exist.
 */
export function buildCreateObjectCommand(
    state: EditorWorkingState,
    layerId: string,
    defId: string,
    position: Vec2,
    rotation = 0,
): CreateObjectResult | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const layer = working.layers.find((l) => l.id === layerId);
    if (!layer) return null;
    const defExists = working.objectDefs.some((d) => d.id === defId);
    if (!defExists) return null;

    const guid = newGuid();
    const counters = new Map(state.counters);
    const name = nextDisplayName(counters, 'object');

    const placement: ObjectPlacement & { name: string } = {
        id: guid,
        name,
        objectDefId: defId,
        position: { x: position.x, y: position.y },
        rotation,
        scale: { x: 1, y: 1 },
    };
    layer.objects.push(placement);

    const after = JSON.stringify(working);
    return {
        command: new SnapshotCommand(before, after, 'Create object', true),
        newGuid: guid,
    };
}
