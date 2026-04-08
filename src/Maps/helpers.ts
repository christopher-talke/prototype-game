import { Arena } from './arena';

const MAPS: Record<string, MapData> = {
    Arena,
};

let activeMap: MapData = Arena;

export function getActiveMap(): MapData {
    return activeMap;
}