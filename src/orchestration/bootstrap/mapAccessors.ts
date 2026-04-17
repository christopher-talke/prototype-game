/**
 * Phase 1 map accessors -- translate v1.5 layered MapData into the flat
 * shapes simulation/rendering still expect. Lives in orchestration since
 * it bridges the canonical config to downstream consumers.
 *
 * Phase 2a replaces these with the per-floor physics compiler + MapRenderer.
 */

import type {
    MapData,
    Wall,
    LightPlacement,
    Vec2,
    DecalPlacement,
} from '@shared/map/MapData';

/** Flatten all walls from every layer that renders/collides them. */
export function collectAllWalls(map: MapData): Wall[] {
    const out: Wall[] = [];
    for (const layer of map.layers) {
        if (layer.type === 'collision' || layer.type === 'ceiling' || layer.type === 'object') {
            for (const w of layer.walls) out.push(w);
        }
    }
    return out;
}

/** Flatten all standalone layer lights (object-attached lights land in Phase 2b). */
export function collectAllLights(map: MapData): LightPlacement[] {
    const out: LightPlacement[] = [];
    for (const layer of map.layers) {
        for (const l of layer.lights) out.push(l);
    }
    return out;
}

/** Spawn points keyed by legacy numeric team id. Polygon centre = spawn point. */
export function getSpawnsByTeam(map: MapData): Record<number, Vec2[]> {
    const out: Record<number, Vec2[]> = {};
    for (const zone of map.zones) {
        if (zone.type !== 'spawn' || zone.team === undefined) continue;
        const teamNum = Number(zone.team);
        if (!Number.isFinite(teamNum)) continue;
        const c = polygonCentroid(zone.polygon);
        if (!out[teamNum]) out[teamNum] = [];
        out[teamNum].push(c);
    }
    return out;
}

/** Cover nav hint positions. Consumed by AI patrol in Phase 1. */
export function getCoverPoints(map: MapData): Vec2[] {
    return map.navHints.filter((h) => h.type === 'cover').map((h) => h.position);
}

/** All floor-layer decals. Renderer filters by asset path to separate texture vs gloss. */
export function getFloorDecals(map: MapData): DecalPlacement[] {
    const out: DecalPlacement[] = [];
    for (const layer of map.layers) {
        if (layer.type !== 'floor') continue;
        for (const d of layer.decals) out.push(d);
    }
    return out;
}

/** World size from bounds. */
export function getWorldSize(map: MapData): { width: number; height: number } {
    return { width: map.bounds.width, height: map.bounds.height };
}

function polygonCentroid(poly: Vec2[]): Vec2 {
    let sx = 0;
    let sy = 0;
    for (const p of poly) {
        sx += p.x;
        sy += p.y;
    }
    const n = poly.length || 1;
    return { x: sx / n, y: sy / n };
}

/** Wall AABB derived from vertices. Used by DOM renderer and bullet broadphase. */
export function wallAABB(w: Wall): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of w.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
