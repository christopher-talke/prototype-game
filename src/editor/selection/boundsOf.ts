/**
 * Unified AABB calculator for any item kind in the editor.
 *
 * Used by selection visuals (bbox draw), box-select containment tests,
 * camera centerOn, and the multi-select transform pivot.
 *
 * Part of the editor layer.
 */

import type {
    Wall,
    ObjectPlacement,
    EntityPlacement,
    DecalPlacement,
    LightPlacement,
    Zone,
    NavHint,
    ObjectDefinition,
    EntityTypeDefinition,
} from '@shared/map/MapData';

import type { ItemKind, ItemRef, EditorWorkingState } from '../state/EditorWorkingState';

export interface AABB {
    x: number;
    y: number;
    width: number;
    height: number;
}

const ZERO_AABB: AABB = { x: 0, y: 0, width: 0, height: 0 };

/** AABB for any item kind. Returns zero-sized box if the item is unknown. */
export function boundsOf(state: EditorWorkingState, ref: ItemRef): AABB {
    const item = lookupItem(state, ref);
    if (!item) return { ...ZERO_AABB };
    return boundsForItem(state, ref.kind, item);
}

/** AABB by raw GUID. Resolves the ItemRef internally. */
export function boundsOfGUID(state: EditorWorkingState, guid: string): AABB {
    const ref = state.byGUID.get(guid);
    if (!ref) return { ...ZERO_AABB };
    return boundsOf(state, ref);
}

/** Union AABB of many items. Returns zero-sized box if guids is empty. */
export function unionBounds(state: EditorWorkingState, guids: Iterable<string>): AABB {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;
    for (const guid of guids) {
        const b = boundsOfGUID(state, guid);
        if (b.width === 0 && b.height === 0) continue;
        any = true;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    if (!any) return { ...ZERO_AABB };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** True if `inner` lies fully inside `outer` (used by box-select). */
export function aabbContains(outer: AABB, inner: AABB): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    );
}

/** True if a point is inside an AABB. */
export function aabbContainsPoint(box: AABB, x: number, y: number): boolean {
    return x >= box.x && y >= box.y && x <= box.x + box.width && y <= box.y + box.height;
}

function lookupItem(state: EditorWorkingState, ref: ItemRef): unknown {
    const map = state.map;
    switch (ref.kind) {
        case 'wall':
        case 'object':
        case 'entity':
        case 'decal':
        case 'light': {
            if (!ref.layerId) return null;
            const layer = map.layers.find((l) => l.id === ref.layerId);
            if (!layer) return null;
            const arr = layerArrayFor(layer, ref.kind);
            return arr.find((it: { id: string }) => it.id === ref.guid) ?? null;
        }
        case 'zone':
            return map.zones.find((z) => z.id === ref.guid) ?? null;
        case 'navHint':
            return map.navHints.find((n) => n.id === ref.guid) ?? null;
    }
}

function layerArrayFor(
    layer: import('@shared/map/MapData').MapLayer,
    kind: ItemKind,
): { id: string }[] {
    switch (kind) {
        case 'wall': return layer.walls;
        case 'object': return layer.objects;
        case 'entity': return layer.entities;
        case 'decal': return layer.decals;
        case 'light': return layer.lights;
        default: return [];
    }
}

function boundsForItem(state: EditorWorkingState, kind: ItemKind, item: unknown): AABB {
    switch (kind) {
        case 'wall': return wallBounds(item as Wall);
        case 'object': return objectBounds(state, item as ObjectPlacement);
        case 'entity': return entityBounds(state, item as EntityPlacement);
        case 'decal': return decalBounds(item as DecalPlacement);
        case 'light': return lightBounds(item as LightPlacement);
        case 'zone': return zoneBounds(item as Zone);
        case 'navHint': return navHintBounds(item as NavHint);
    }
}

function wallBounds(w: Wall): AABB {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of w.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    if (!isFinite(minX)) return { ...ZERO_AABB };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function objectBounds(state: EditorWorkingState, p: ObjectPlacement): AABB {
    const def = state.map.objectDefs.find((d) => d.id === p.objectDefId);
    return defAABB(p.position, p.scale, def);
}

function entityBounds(state: EditorWorkingState, p: EntityPlacement): AABB {
    const def = state.map.entityDefs.find((d) => d.id === p.entityTypeId);
    return defAABB(p.position, { x: 1, y: 1 }, def);
}

function defAABB(
    pos: { x: number; y: number },
    scale: { x: number; y: number },
    def: ObjectDefinition | EntityTypeDefinition | undefined,
): AABB {
    const cs = def?.collisionShape;
    if (!cs) {
        const r = 8;
        return { x: pos.x - r, y: pos.y - r, width: r * 2, height: r * 2 };
    }
    if (cs.type === 'aabb') {
        return {
            x: pos.x + cs.x * scale.x,
            y: pos.y + cs.y * scale.y,
            width: cs.width * scale.x,
            height: cs.height * scale.y,
        };
    }
    if (cs.type === 'circle') {
        const rx = cs.radius * scale.x;
        const ry = cs.radius * scale.y;
        return {
            x: pos.x + cs.center.x * scale.x - rx,
            y: pos.y + cs.center.y * scale.y - ry,
            width: rx * 2,
            height: ry * 2,
        };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of cs.vertices) {
        const wx = pos.x + v.x * scale.x;
        const wy = pos.y + v.y * scale.y;
        if (wx < minX) minX = wx;
        if (wy < minY) minY = wy;
        if (wx > maxX) maxX = wx;
        if (wy > maxY) maxY = wy;
    }
    if (!isFinite(minX)) return { x: pos.x, y: pos.y, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function decalBounds(p: DecalPlacement): AABB {
    const w = 32 * p.scale.x;
    const h = 32 * p.scale.y;
    return { x: p.position.x - w / 2, y: p.position.y - h / 2, width: w, height: h };
}

function lightBounds(p: LightPlacement): AABB {
    const r = Math.max(p.radius, 12);
    return { x: p.position.x - r, y: p.position.y - r, width: r * 2, height: r * 2 };
}

function zoneBounds(z: Zone): AABB {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of z.polygon) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    if (!isFinite(minX)) return { ...ZERO_AABB };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function navHintBounds(n: NavHint): AABB {
    const r = Math.max(n.radius, 12);
    return { x: n.position.x - r, y: n.position.y - r, width: r * 2, height: r * 2 };
}
