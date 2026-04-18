/**
 * Factory: create a new Zone with the given polygon and type. Structural.
 *
 * Zones are map-level (not per-layer). Allocates GUID + display name, appends
 * to `map.zones`. `floorId` defaults to the active floor.
 *
 * Part of the editor layer.
 */

import type { Vec2, Zone, ZoneType } from '@shared/map/MapData';

import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { cloneMapData } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

export interface CreateZoneResult {
    command: SnapshotCommand;
    newGuid: string;
}

/**
 * Build a command that appends a new Zone to `map.zones`.
 * Returns null if polygon has fewer than 3 vertices.
 */
export function buildCreateZoneCommand(
    state: EditorWorkingState,
    polygon: Vec2[],
    zoneType: ZoneType,
    floorId?: string,
): CreateZoneResult | null {
    if (polygon.length < 3) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);

    const guid = newGuid();
    const counters = new Map(state.counters);
    const name = nextDisplayName(counters, 'zone');

    const zone: Zone & { name: string } = {
        id: guid,
        name,
        type: zoneType,
        label: name,
        polygon: polygon.map((v) => ({ x: v.x, y: v.y })),
        floorId: floorId ?? state.activeFloorId,
        meta: {},
    };
    working.zones.push(zone);

    const after = JSON.stringify(working);
    return {
        command: new SnapshotCommand(before, after, 'Create zone', true),
        newGuid: guid,
    };
}
