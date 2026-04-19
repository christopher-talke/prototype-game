/**
 * Runtime data model for the editor.
 *
 * Built from `MapData` on load and maintained in sync via commands. Flat
 * indexes (GUID, layer, floor) keep lookup O(1). Never query `MapData`
 * directly while editing -- always go through the indexes here.
 *
 * Replacement semantics: `replaceFromSnapshot` rebuilds the entire state from
 * a JSON snapshot. Commands use this for undo/redo.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import { buildFromMapData } from './buildFromMapData';
import { type DisplayNameCounters, createCounters } from '../guid/displayNameCounter';
import type { Group } from '../groups/Group';
import { pruneGroupsAgainstItems } from '../groups/groupQueries';

export type ItemKind = 'wall' | 'object' | 'entity' | 'decal' | 'light' | 'zone' | 'navHint';

export interface ItemRef {
    kind: ItemKind;
    guid: string;
    /** Display name (sugar, not identity). */
    name: string;
    /** Layer id for per-layer items. Undefined for zones/navHints. */
    layerId?: string;
    /** Floor id for per-layer items (mirrored from layer). Undefined for top-level items. */
    floorId?: string;
}

export interface EditorWorkingState {
    map: MapData;
    byGUID: Map<string, ItemRef>;
    byLayer: Map<string, Set<string>>;
    byFloor: Map<string, Set<string>>;
    counters: DisplayNameCounters;
    activeFloorId: string;
    activeLayerId: string;
    /**
     * Runtime-only set of item GUIDs the user has hidden via the eye toggle in
     * the item list. Not persisted, not snapshotted into MapData. Resets on
     * reload.
     */
    editorHiddenGUIDs: Set<string>;
    /**
     * Editor-only item groups. Persisted in IndexedDB editor state, never
     * written to MapData. Keyed by group id. Groups may nest (members can be
     * other group ids); same-floor constraint enforced at command time.
     */
    groups: Map<string, Group>;
}

/** Construct a new EditorWorkingState from a MapData. */
export function createWorkingState(map: MapData): EditorWorkingState {
    const state: EditorWorkingState = {
        map,
        byGUID: new Map(),
        byLayer: new Map(),
        byFloor: new Map(),
        counters: createCounters(),
        activeFloorId: map.floors[0]?.id ?? '',
        activeLayerId: map.layers[0]?.id ?? '',
        editorHiddenGUIDs: new Set(),
        groups: new Map(),
    };
    buildFromMapData(state, map);
    return state;
}

/**
 * Replace the state's data from a MapData JSON snapshot. Rebuilds all indexes
 * and counters. Preserves `activeFloorId` / `activeLayerId` if they still
 * exist in the new data; otherwise defaults to the first floor/layer.
 */
export function replaceFromSnapshot(state: EditorWorkingState, snapshotJson: string): void {
    const map = JSON.parse(snapshotJson) as MapData;
    state.map = map;
    state.byGUID.clear();
    state.byLayer.clear();
    state.byFloor.clear();
    state.counters.clear();
    buildFromMapData(state, map);

    if (!map.floors.some((f) => f.id === state.activeFloorId)) {
        state.activeFloorId = map.floors[0]?.id ?? '';
    }
    if (!map.layers.some((l) => l.id === state.activeLayerId)) {
        state.activeLayerId = map.layers[0]?.id ?? '';
    }

    for (const guid of state.editorHiddenGUIDs) {
        if (!state.byGUID.has(guid)) state.editorHiddenGUIDs.delete(guid);
    }

    pruneGroupsAgainstItems(state);
}
