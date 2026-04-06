import { Arena } from './arena';
import { LOSShowcase } from './showcase';

const MAPS: Record<string, MapData> = {
    Arena,
    LOSShowcase,
};

let activeMap: MapData = Arena;

export function getActiveMap(): MapData {
    return activeMap;
}

export function setActiveMap(name: string) {
    const map = MAPS[name];
    if (map) activeMap = map;
}

export function getMapNames(): string[] {
    return Object.keys(MAPS);
}
