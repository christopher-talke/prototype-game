import { Arena } from './arena';

let activeMap: MapData = Arena;

export function getActiveMap(): MapData {
    return activeMap;
}