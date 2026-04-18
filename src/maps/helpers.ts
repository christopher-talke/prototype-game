import type { MapData } from '@shared/map/MapData';
import { Arena } from './arena';
import { Shipment } from './shipment';

/**
 * Catalog entry linking a map id to its display metadata and geometry data.
 * Used by the map picker UI and the orchestration layer's map loader.
 */
export type MapEntry = {
    /** Unique slug used as lookup key (e.g. 'arena', 'shipment'). */
    id: string;
    /** Human-readable name shown in the map picker. */
    name: string;
    /** Short description shown below the map name in the picker. */
    description: string;
    /** Full map geometry, lighting, spawns, and wall data. */
    data: MapData;
};

/**
 * Ordered list of all available maps.
 * The first entry is the default map loaded on startup.
 */
export const MAP_LIST: MapEntry[] = [
    { id: 'arena', name: 'Arena', description: 'Open plaza with four corner rooms connected by wide corridors', data: Arena },
    { id: 'shipment', name: 'Shipment', description: 'Tiny container yard with tight lanes and constant close-quarters action', data: Shipment },
];

const mapLookup = new Map(MAP_LIST.map((m) => [m.id, m]));

let activeMapId = 'arena';
let activeMap: MapData = Arena;

/**
 * Returns the currently active map data.
 *
 * @returns The {@link MapData} for the active map.
 */
export function getActiveMap(): MapData {
    return activeMap;
}

/**
 * Returns the id of the currently active map.
 *
 * @returns The active map's slug (e.g. 'arena').
 */
export function getActiveMapId(): string {
    return activeMapId;
}

/**
 * Switches the active map by id. If the id is not found in the
 * map registry, this is a no-op.
 *
 * @param id - Map slug to activate (e.g. 'shipment').
 */
export function setActiveMap(id: string): void {
    const entry = mapLookup.get(id);
    if (entry) {
        activeMapId = id;
        activeMap = entry.data;
    }
}

/**
 * Set the active map directly from a MapData object, bypassing the ID
 * registry. Used by the editor play-test mode to inject the current
 * working map without registering it.
 *
 * @param data - The MapData to activate.
 */
export function setActiveMapData(data: MapData): void {
    activeMapId = 'editor-playtest';
    activeMap = data;
}
