/**
 * Factory: create a new EntityPlacement on the given layer. Structural.
 *
 * Clones the def's initialState and augments it with type-aware empty defaults
 * for any schema fields not already present. Per Phase-3 spec:
 *   primitive -> 0, layerId/entityId/teamId/signalId -> ''
 *
 * Part of the editor layer.
 */

import type {
    EntityPlacement,
    Vec2,
} from '@shared/map/MapData';

import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { defaultForEntityStateDescriptor } from './entityStateDefaults';
import { cloneMapData } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

export interface CreateEntityResult {
    command: SnapshotCommand;
    newGuid: string;
}

/**
 * Build a command that appends a new EntityPlacement to `layerId`.
 * Returns null if the layer or entity def do not exist.
 */
export function buildCreateEntityCommand(
    state: EditorWorkingState,
    layerId: string,
    defId: string,
    position: Vec2,
    rotation = 0,
): CreateEntityResult | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    
    const layer = working.layers.find((l) => l.id === layerId);
    if (!layer) return null;

    const def = working.entityDefs.find((d) => d.id === defId);
    if (!def) return null;

    const guid = newGuid();
    const counters = new Map(state.counters);
    const name = nextDisplayName(counters, 'entity');

    const initialState: Record<string, unknown> = { ...(def.initialState ?? {}) };
    if (def.stateSchema) {
        for (const [key, descriptor] of Object.entries(def.stateSchema)) {
            if (key in initialState) continue;
            initialState[key] = defaultForEntityStateDescriptor(descriptor);
        }
    }

    const placement: EntityPlacement & { name: string } = {
        id: guid,
        name,
        entityTypeId: defId,
        position: { x: position.x, y: position.y },
        rotation,
        initialState,
    };
    layer.entities.push(placement);

    const after = JSON.stringify(working);
    return {
        command: new SnapshotCommand(before, after, 'Create entity', true),
        newGuid: guid,
    };
}

