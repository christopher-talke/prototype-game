import { Arena } from './arena';
import { Shipment } from './shipment';

export type MapEntry = {
    id: string;
    name: string;
    description: string;
    data: MapData;
};

export const MAP_LIST: MapEntry[] = [
    { id: 'arena', name: 'Arena', description: 'Open plaza with four corner rooms connected by wide corridors', data: Arena },
    { id: 'shipment', name: 'Shipment', description: 'Tiny container yard with tight lanes and constant close-quarters action', data: Shipment },
];

const mapLookup = new Map(MAP_LIST.map((m) => [m.id, m]));

let activeMap: MapData = Arena;

export function getActiveMap(): MapData {
    return activeMap;
}

export function setActiveMap(id: string): void {
    const entry = mapLookup.get(id);
    if (entry) activeMap = entry.data;
}
