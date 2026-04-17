/**
 * Runtime registry of dynamic `EntityInstance`s for an active match.
 * Simulation layer: owns instance lifecycle and state mutations.
 *
 * Built at round start from `map.layers[].entities`. State mutations flow
 * through `setState`, which diffs the patch against the previous state and
 * returns an `EntityStateChangedEvent` (or `null` if nothing changed) for the
 * caller to surface via the simulation's event bubbling.
 */

import type { MapData, EntityPlacement, MapLayer } from '@shared/map/MapData';
import type { EntityStateChangedEvent } from '@simulation/events';
import type { EntityDefRegistry } from '@orchestration/bootstrap/entityDefRegistry';
import type { EntityInstance } from './entityInstance';

export class EntityRegistry {
    private readonly byId = new Map<string, EntityInstance>();
    private readonly byFloor = new Map<string, Set<string>>();

    static fromMap(map: MapData, defRegistry: EntityDefRegistry): EntityRegistry {
        const reg = new EntityRegistry();
        for (const layer of map.layers) {
            for (const placement of layer.entities) {
                reg.insert(layer, placement, defRegistry);
            }
        }
        return reg;
    }

    private insert(layer: MapLayer, placement: EntityPlacement, defRegistry: EntityDefRegistry): void {
        const def = defRegistry.resolve(placement.entityTypeId);
        const instance: EntityInstance = {
            id: placement.id,
            typeId: def.id,
            floorId: layer.floorId,
            position: placement.position,
            rotation: placement.rotation,
            state: { ...def.initialState, ...placement.initialState },
            collisionShape: def.collisionShape,
            interactionRadius: def.interactionRadius,
        };
        this.byId.set(instance.id, instance);
        let onFloor = this.byFloor.get(layer.floorId);
        if (!onFloor) {
            onFloor = new Set();
            this.byFloor.set(layer.floorId, onFloor);
        }
        onFloor.add(instance.id);
    }

    get(id: string): EntityInstance | undefined {
        return this.byId.get(id);
    }

    all(): IterableIterator<EntityInstance> {
        return this.byId.values();
    }

    getIdsByFloor(floorId: string): ReadonlySet<string> {
        return this.byFloor.get(floorId) ?? EMPTY_SET;
    }

    getByFloor(floorId: string): EntityInstance[] {
        const out: EntityInstance[] = [];
        const ids = this.byFloor.get(floorId);
        if (!ids) return out;
        for (const id of ids) {
            const inst = this.byId.get(id);
            if (inst) out.push(inst);
        }
        return out;
    }

    /**
     * Applies `patch` to the entity's state. Returns an
     * `ENTITY_STATE_CHANGED` event describing the diff, or `null` when the
     * patch introduces no changes. The caller is responsible for bubbling the
     * event into the simulation's tick output.
     */
    setState(id: string, patch: Record<string, unknown>): EntityStateChangedEvent | null {
        const inst = this.byId.get(id);
        if (!inst) return null;
        const prev = inst.state;
        const changedFields: string[] = [];
        for (const [k, v] of Object.entries(patch)) {
            if (!Object.is(prev[k], v)) changedFields.push(k);
        }
        if (changedFields.length === 0) return null;
        const next = { ...prev, ...patch };
        inst.state = next;
        return {
            type: 'ENTITY_STATE_CHANGED',
            entityId: id,
            prevState: prev,
            newState: next,
            changedFields,
        };
    }
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
