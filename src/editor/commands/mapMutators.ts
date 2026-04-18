/**
 * Pure helpers that produce a mutated MapData from an input MapData + an
 * operation descriptor. All editor commands compose these helpers between
 * `JSON.parse(JSON.stringify(state.map))` and `JSON.stringify(working)` to
 * build the before/after snapshots that SnapshotCommand consumes.
 *
 * Part of the editor layer.
 */

import type {
    DecalPlacement,
    EntityPlacement,
    LightPlacement,
    MapData,
    MapLayer,
    NavHint,
    ObjectPlacement,
    Wall,
    Zone,
} from '@shared/map/MapData';

import type { ItemKind } from '../state/EditorWorkingState';

export interface ItemTransformDelta {
    guid: string;
    dx?: number;
    dy?: number;
    dRotation?: number;
    scaleMultiplier?: { x: number; y: number };
    /** World-space pivot for rotate/scale. Required when dRotation or scaleMultiplier is set. */
    pivot?: { x: number; y: number };
}

/** Mutate `map` in-place: apply the position/rotation/scale deltas to each item. */
export function applyTransforms(map: MapData, transforms: ItemTransformDelta[]): void {
    for (const t of transforms) {
        const found = findAnyItem(map, t.guid);
        if (!found) continue;
        applyTransformToItem(found.kind, found.item, t);
    }
}

/** Mutate `map` in-place: set `path` to `value` on the item identified by guid.
 * Missing intermediate objects are created so nested paths (e.g. ['meta', 'signal'])
 * work on legacy items that lack the `meta` field. */
export function setProperty(map: MapData, guid: string, path: string[], value: unknown): void {
    const found = findAnyItem(map, guid);
    if (!found) return;
    let cursor: Record<string, unknown> = found.item as unknown as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const next = cursor[key];
        if (typeof next === 'object' && next !== null) {
            cursor = next as Record<string, unknown>;
            continue;
        }
        const created: Record<string, unknown> = {};
        cursor[key] = created;
        cursor = created;
    }
    cursor[path[path.length - 1]] = value;
}

/** Mutate `map` in-place: remove the items by guid. Returns the kinds removed. */
export function deleteItems(map: MapData, guids: string[]): ItemKind[] {
    const removed: ItemKind[] = [];
    const set = new Set(guids);
    for (const layer of map.layers) {
        layer.walls = filterOut(layer.walls, set, removed, 'wall');
        layer.objects = filterOut(layer.objects, set, removed, 'object');
        layer.entities = filterOut(layer.entities, set, removed, 'entity');
        layer.decals = filterOut(layer.decals, set, removed, 'decal');
        layer.lights = filterOut(layer.lights, set, removed, 'light');
    }
    map.zones = filterOut(map.zones, set, removed, 'zone');
    map.navHints = filterOut(map.navHints, set, removed, 'navHint');
    return removed;
}

/** Mutate `map` in-place: rename the item by guid. No-op if guid is unknown. */
export function setItemName(map: MapData, guid: string, name: string): void {
    const found = findAnyItem(map, guid);
    if (!found) return;
    (found.item as { name?: string }).name = name;
}

/** Find a layer by id (returns undefined if missing). */
export function findLayer(map: MapData, layerId: string): MapLayer | undefined {
    return map.layers.find((l) => l.id === layerId);
}

/** Mutate `map` in-place: move the items to `targetLayerId` (must be same floor). */
export function moveItemsToLayer(map: MapData, guids: string[], targetLayerId: string): void {
    const target = findLayer(map, targetLayerId);
    if (!target) return;
    const set = new Set(guids);
    for (const layer of map.layers) {
        if (layer.id === target.id) continue;
        target.walls.push(...takeOut(layer.walls, set));
        target.objects.push(...takeOut(layer.objects, set));
        target.entities.push(...takeOut(layer.entities, set));
        target.decals.push(...takeOut(layer.decals, set));
        target.lights.push(...takeOut(layer.lights, set));
    }
}

/** Pure clone: produces a deep-cloned MapData via JSON. */
export function cloneMapData(map: MapData): MapData {
    return JSON.parse(JSON.stringify(map)) as MapData;
}

interface FoundItem {
    kind: ItemKind;
    item: unknown;
}

function findAnyItem(map: MapData, guid: string): FoundItem | null {
    for (const layer of map.layers) {
        const w = layer.walls.find((x) => x.id === guid);
        if (w) return { kind: 'wall', item: w };
        const o = layer.objects.find((x) => x.id === guid);
        if (o) return { kind: 'object', item: o };
        const e = layer.entities.find((x) => x.id === guid);
        if (e) return { kind: 'entity', item: e };
        const d = layer.decals.find((x) => x.id === guid);
        if (d) return { kind: 'decal', item: d };
        const l = layer.lights.find((x) => x.id === guid);
        if (l) return { kind: 'light', item: l };
    }
    const z = map.zones.find((x) => x.id === guid);
    if (z) return { kind: 'zone', item: z };
    const n = map.navHints.find((x) => x.id === guid);
    if (n) return { kind: 'navHint', item: n };
    return null;
}

function applyTransformToItem(kind: ItemKind, item: unknown, t: ItemTransformDelta): void {
    const dx = t.dx ?? 0;
    const dy = t.dy ?? 0;
    const dRot = t.dRotation ?? 0;
    const sm = t.scaleMultiplier;
    const pv = t.pivot;
    switch (kind) {
        case 'wall': {
            const w = item as Wall;
            const cos = dRot !== 0 ? Math.cos(dRot) : 1;
            const sin = dRot !== 0 ? Math.sin(dRot) : 0;
            for (const v of w.vertices) {
                v.x += dx;
                v.y += dy;
                if (dRot !== 0 && pv) {
                    const rx = v.x - pv.x;
                    const ry = v.y - pv.y;
                    v.x = pv.x + rx * cos - ry * sin;
                    v.y = pv.y + rx * sin + ry * cos;
                }
                if (sm && pv) {
                    v.x = pv.x + (v.x - pv.x) * sm.x;
                    v.y = pv.y + (v.y - pv.y) * sm.y;
                }
            }
            return;
        }
        case 'object': {
            const o = item as ObjectPlacement;
            o.position.x += dx;
            o.position.y += dy;
            if (dRot !== 0) {
                if (pv) {
                    const cos = Math.cos(dRot);
                    const sin = Math.sin(dRot);
                    const rx = o.position.x - pv.x;
                    const ry = o.position.y - pv.y;
                    o.position.x = pv.x + rx * cos - ry * sin;
                    o.position.y = pv.y + rx * sin + ry * cos;
                }
                o.rotation += dRot;
            }
            if (sm) {
                if (pv) {
                    o.position.x = pv.x + (o.position.x - pv.x) * sm.x;
                    o.position.y = pv.y + (o.position.y - pv.y) * sm.y;
                }
                o.scale.x *= sm.x;
                o.scale.y *= sm.y;
            }
            return;
        }
        case 'entity': {
            const e = item as EntityPlacement;
            e.position.x += dx;
            e.position.y += dy;
            if (dRot !== 0) {
                if (pv) {
                    const cos = Math.cos(dRot);
                    const sin = Math.sin(dRot);
                    const rx = e.position.x - pv.x;
                    const ry = e.position.y - pv.y;
                    e.position.x = pv.x + rx * cos - ry * sin;
                    e.position.y = pv.y + rx * sin + ry * cos;
                }
                e.rotation += dRot;
            }
            if (sm && pv) {
                e.position.x = pv.x + (e.position.x - pv.x) * sm.x;
                e.position.y = pv.y + (e.position.y - pv.y) * sm.y;
            }
            return;
        }
        case 'decal': {
            const d = item as DecalPlacement;
            d.position.x += dx;
            d.position.y += dy;
            if (dRot !== 0) {
                if (pv) {
                    const cos = Math.cos(dRot);
                    const sin = Math.sin(dRot);
                    const rx = d.position.x - pv.x;
                    const ry = d.position.y - pv.y;
                    d.position.x = pv.x + rx * cos - ry * sin;
                    d.position.y = pv.y + rx * sin + ry * cos;
                }
                d.rotation += dRot;
            }
            if (sm) {
                if (pv) {
                    d.position.x = pv.x + (d.position.x - pv.x) * sm.x;
                    d.position.y = pv.y + (d.position.y - pv.y) * sm.y;
                }
                d.scale.x *= sm.x;
                d.scale.y *= sm.y;
            }
            return;
        }
        case 'light': {
            const l = item as LightPlacement;
            l.position.x += dx;
            l.position.y += dy;
            if (dRot !== 0) {
                if (pv) {
                    const cos = Math.cos(dRot);
                    const sin = Math.sin(dRot);
                    const rx = l.position.x - pv.x;
                    const ry = l.position.y - pv.y;
                    l.position.x = pv.x + rx * cos - ry * sin;
                    l.position.y = pv.y + rx * sin + ry * cos;
                }
                l.coneDirection += dRot;
            }
            if (sm && pv) {
                l.position.x = pv.x + (l.position.x - pv.x) * sm.x;
                l.position.y = pv.y + (l.position.y - pv.y) * sm.y;
            }
            return;
        }
        case 'zone': {
            const z = item as Zone;
            const cos = dRot !== 0 ? Math.cos(dRot) : 1;
            const sin = dRot !== 0 ? Math.sin(dRot) : 0;
            for (const v of z.polygon) {
                v.x += dx;
                v.y += dy;
                if (dRot !== 0 && pv) {
                    const rx = v.x - pv.x;
                    const ry = v.y - pv.y;
                    v.x = pv.x + rx * cos - ry * sin;
                    v.y = pv.y + rx * sin + ry * cos;
                }
                if (sm && pv) {
                    v.x = pv.x + (v.x - pv.x) * sm.x;
                    v.y = pv.y + (v.y - pv.y) * sm.y;
                }
            }
            return;
        }
        case 'navHint': {
            const n = item as NavHint;
            n.position.x += dx;
            n.position.y += dy;
            if (dRot !== 0 && pv) {
                const cos = Math.cos(dRot);
                const sin = Math.sin(dRot);
                const rx = n.position.x - pv.x;
                const ry = n.position.y - pv.y;
                n.position.x = pv.x + rx * cos - ry * sin;
                n.position.y = pv.y + rx * sin + ry * cos;
            }
            if (sm && pv) {
                n.position.x = pv.x + (n.position.x - pv.x) * sm.x;
                n.position.y = pv.y + (n.position.y - pv.y) * sm.y;
            }
            return;
        }
    }
}

function filterOut<T extends { id: string }>(
    arr: T[],
    set: Set<string>,
    removedKinds: ItemKind[],
    kind: ItemKind,
): T[] {
    const next: T[] = [];
    for (const item of arr) {
        if (set.has(item.id)) removedKinds.push(kind);
        else next.push(item);
    }
    return next;
}

function takeOut<T extends { id: string }>(arr: T[], set: Set<string>): T[] {
    const taken: T[] = [];
    let writeIdx = 0;
    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (set.has(item.id)) {
            taken.push(item);
        } else {
            arr[writeIdx++] = item;
        }
    }
    arr.length = writeIdx;
    return taken;
}
