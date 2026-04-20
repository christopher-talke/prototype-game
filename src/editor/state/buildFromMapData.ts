/**
 * Hydrate EditorWorkingState indexes from MapData.
 *
 * Walks every layer (walls, objects, entities, decals, lights), every zone,
 * every navHint, registers each in byGUID/byLayer/byFloor and seeds the
 * display-name counter for each item type.
 *
 * Part of the editor layer.
 */

import type { MapData, MapLayer } from '@shared/map/MapData';

import type { EditorWorkingState, ItemKind, ItemRef } from './EditorWorkingState';
import { seedCounterFromNames } from '../guid/displayNameCounter';

interface WithIdLabel {
    id: string;
    label?: string;
    name?: string;
}

/** Populate `state`'s indexes and counters from `map`. State fields `map`, `activeFloorId`, `activeLayerId` are not touched. */
export function buildFromMapData(state: EditorWorkingState, map: MapData): void {
    const namesByType: Map<string, string[]> = new Map();

    const indexItem = (
        kind: ItemKind,
        item: WithIdLabel,
        layerId: string | undefined,
        floorId: string | undefined,
    ) => {
        const name =
            typeof item.label === 'string'
                ? item.label
                : typeof item.name === 'string'
                    ? item.name
                    : item.id;
        const ref: ItemRef = {
            kind,
            guid: item.id,
            name,
            ...(layerId !== undefined ? { layerId } : {}),
            ...(floorId !== undefined ? { floorId } : {}),
        };
        state.byGUID.set(item.id, ref);

        if (layerId !== undefined) {
            let set = state.byLayer.get(layerId);
            if (!set) {
                set = new Set();
                state.byLayer.set(layerId, set);
            }
            set.add(item.id);
        }
        if (floorId !== undefined) {
            let set = state.byFloor.get(floorId);
            if (!set) {
                set = new Set();
                state.byFloor.set(floorId, set);
            }
            set.add(item.id);
        }

        const bucket = namesByType.get(kind);
        if (bucket) bucket.push(name);
        else namesByType.set(kind, [name]);
    };

    for (const layer of map.layers) {
        indexLayerItems(layer, indexItem);
    }

    for (const zone of map.zones) {
        const floorId = zone.floorId;
        indexItem('zone', zone, undefined, floorId);
    }

    for (const hint of map.navHints) {
        indexItem('navHint', hint, undefined, undefined);
    }

    for (const [type, names] of namesByType) {
        seedCounterFromNames(state.counters, type, names);
    }
}

function indexLayerItems(
    layer: MapLayer,
    indexItem: (
        kind: ItemKind,
        item: WithIdLabel,
        layerId: string | undefined,
        floorId: string | undefined,
    ) => void,
): void {
    for (const wall of layer.walls) indexItem('wall', wall, layer.id, layer.floorId);
    for (const obj of layer.objects) indexItem('object', obj, layer.id, layer.floorId);
    for (const ent of layer.entities) indexItem('entity', ent, layer.id, layer.floorId);
    for (const decal of layer.decals) indexItem('decal', decal, layer.id, layer.floorId);
    for (const light of layer.lights) indexItem('light', light, layer.id, layer.floorId);
}
