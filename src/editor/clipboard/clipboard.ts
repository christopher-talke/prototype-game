/**
 * Internal editor clipboard.
 *
 * Singleton store of the most recent copy/cut payload. Not the OS clipboard.
 * Items are stored with positions relative to the group's bbox centre at copy
 * time; paste applies an absolute world position to that centre.
 *
 * Part of the editor layer.
 */

import type {
    DecalPlacement,
    EntityPlacement,
    LightPlacement,
    MapData,
    NavHint,
    ObjectPlacement,
    Vec2,
    Wall,
    Zone,
} from '@shared/map/MapData';

import type { EditorWorkingState, ItemKind } from '../state/EditorWorkingState';
import { boundsOfGUID, unionBounds } from '../selection/boundsOf';

import type { SerializedItem } from './serializedItem';

interface ClipboardPayload {
    items: SerializedItem[];
    sourceCentre: Vec2;
}

let payload: ClipboardPayload | null = null;

/** Returns true if there is something to paste. */
export function hasClipboard(): boolean {
    return payload !== null && payload.items.length > 0;
}

/** Returns the current clipboard size (number of items). */
export function clipboardCount(): number {
    return payload?.items.length ?? 0;
}

/** Capture the supplied items into the clipboard. */
export function copyToClipboard(state: EditorWorkingState, guids: string[]): void {
    if (guids.length === 0) {
        payload = null;
        return;
    }
    const centre = bboxCentre(state, guids);
    const items: SerializedItem[] = [];
    for (const guid of guids) {
        const ref = state.byGUID.get(guid);
        if (!ref) continue;
        const built = serializeItem(state, ref.kind, guid, centre, ref.layerId);
        if (built) items.push(built);
    }
    payload = { items, sourceCentre: centre };
}

/** Snapshot of the current clipboard payload (for cut undo). Returns null if empty. */
export function snapshotClipboard(): ClipboardPayload | null {
    if (!payload) return null;
    return JSON.parse(JSON.stringify(payload)) as ClipboardPayload;
}

/** Restore a previously-captured payload (for cut undo). */
export function restoreClipboard(snap: ClipboardPayload | null): void {
    payload = snap;
}

/** Read the current payload (do not mutate). */
export function readClipboard(): ClipboardPayload | null {
    return payload;
}

function bboxCentre(state: EditorWorkingState, guids: string[]): Vec2 {
    const aabb = unionBounds(state, guids);
    return { x: aabb.x + aabb.width / 2, y: aabb.y + aabb.height / 2 };
}

function serializeItem(
    state: EditorWorkingState,
    kind: ItemKind,
    guid: string,
    centre: Vec2,
    layerId: string | undefined,
): SerializedItem | null {
    const map = state.map;
    if (kind === 'wall' && layerId) {
        const layer = map.layers.find((l) => l.id === layerId);
        const w = layer?.walls.find((x) => x.id === guid);
        if (!w) return null;
        const aabb = boundsOfGUID(state, guid);
        const relative = { x: aabb.x + aabb.width / 2 - centre.x, y: aabb.y + aabb.height / 2 - centre.y };
        const cloned: Omit<Wall, 'id'> = JSON.parse(JSON.stringify({
            vertices: w.vertices,
            solid: w.solid,
            bulletPenetrable: w.bulletPenetrable,
            penetrationDecay: w.penetrationDecay,
            audioOcclude: w.audioOcclude,
            occludesVision: w.occludesVision,
            wallType: w.wallType,
        }));
        return { kind: 'wall', data: cloned, relative, originalLayerId: layerId };
    }
    if (kind === 'object' && layerId) {
        const layer = map.layers.find((l) => l.id === layerId);
        const o = layer?.objects.find((x) => x.id === guid);
        if (!o) return null;
        const data: Omit<ObjectPlacement, 'id'> = JSON.parse(JSON.stringify({
            objectDefId: o.objectDefId,
            position: o.position,
            rotation: o.rotation,
            scale: o.scale,
        }));
        return { kind: 'object', data, relative: { x: o.position.x - centre.x, y: o.position.y - centre.y }, originalLayerId: layerId };
    }
    if (kind === 'entity' && layerId) {
        const layer = map.layers.find((l) => l.id === layerId);
        const e = layer?.entities.find((x) => x.id === guid);
        if (!e) return null;
        const data: Omit<EntityPlacement, 'id'> = JSON.parse(JSON.stringify({
            entityTypeId: e.entityTypeId,
            position: e.position,
            rotation: e.rotation,
            initialState: e.initialState,
        }));
        return { kind: 'entity', data, relative: { x: e.position.x - centre.x, y: e.position.y - centre.y }, originalLayerId: layerId };
    }
    if (kind === 'decal' && layerId) {
        const layer = map.layers.find((l) => l.id === layerId);
        const d = layer?.decals.find((x) => x.id === guid);
        if (!d) return null;
        const data: Omit<DecalPlacement, 'id'> = JSON.parse(JSON.stringify({
            assetPath: d.assetPath,
            position: d.position,
            rotation: d.rotation,
            scale: d.scale,
            alpha: d.alpha,
            blendMode: d.blendMode,
            ...(d.tint ? { tint: d.tint } : {}),
            ...(d.repeat ? { repeat: d.repeat } : {}),
        }));
        return { kind: 'decal', data, relative: { x: d.position.x - centre.x, y: d.position.y - centre.y }, originalLayerId: layerId };
    }
    if (kind === 'light' && layerId) {
        const layer = map.layers.find((l) => l.id === layerId);
        const l = layer?.lights.find((x) => x.id === guid);
        if (!l) return null;
        const data: Omit<LightPlacement, 'id'> = JSON.parse(JSON.stringify({
            position: l.position,
            color: l.color,
            intensity: l.intensity,
            radius: l.radius,
            coneAngle: l.coneAngle,
            coneDirection: l.coneDirection,
            castShadows: l.castShadows,
        }));
        return { kind: 'light', data, relative: { x: l.position.x - centre.x, y: l.position.y - centre.y }, originalLayerId: layerId };
    }
    if (kind === 'zone') {
        const z = map.zones.find((x) => x.id === guid);
        if (!z) return null;
        const aabb = boundsOfGUID(state, guid);
        const c = { x: aabb.x + aabb.width / 2, y: aabb.y + aabb.height / 2 };
        const data: Omit<Zone, 'id'> = JSON.parse(JSON.stringify({
            type: z.type,
            label: z.label,
            polygon: z.polygon,
            ...(z.floorId !== undefined ? { floorId: z.floorId } : {}),
            ...(z.team !== undefined ? { team: z.team } : {}),
            ...(z.gameModes !== undefined ? { gameModes: z.gameModes } : {}),
            ...(z.meta !== undefined ? { meta: z.meta } : {}),
        }));
        return { kind: 'zone', data, relative: { x: c.x - centre.x, y: c.y - centre.y } };
    }
    if (kind === 'navHint') {
        const n = map.navHints.find((x) => x.id === guid);
        if (!n) return null;
        const data: Omit<NavHint, 'id'> = JSON.parse(JSON.stringify({
            type: n.type,
            position: n.position,
            radius: n.radius,
            weight: n.weight,
        }));
        return { kind: 'navHint', data, relative: { x: n.position.x - centre.x, y: n.position.y - centre.y } };
    }
    return null;
}

/**
 * Apply a clipboard payload to a working MapData copy. Returns the new GUIDs
 * created. Mutates `map` in-place.
 */
export function applyClipboardPaste(
    map: MapData,
    items: SerializedItem[],
    targetCentre: Vec2,
    activeLayerId: string,
    nameAllocator: (kind: ItemKind) => string,
    guidFactory: () => string,
): string[] {
    const layer = map.layers.find((l) => l.id === activeLayerId);
    const newGuids: string[] = [];
    for (const item of items) {
        const guid = guidFactory();
        const name = nameAllocator(item.kind);
        switch (item.kind) {
            case 'wall':
                if (!layer) break;
                layer.walls.push(translatedWall(item.data, item.relative, targetCentre, guid, name));
                newGuids.push(guid);
                break;
            case 'object':
                if (!layer) break;
                layer.objects.push(translatedPlacement(item.data, item.relative, targetCentre, guid, name));
                newGuids.push(guid);
                break;
            case 'entity':
                if (!layer) break;
                layer.entities.push(translatedEntity(item.data, item.relative, targetCentre, guid, name));
                newGuids.push(guid);
                break;
            case 'decal':
                if (!layer) break;
                layer.decals.push(translatedDecal(item.data, item.relative, targetCentre, guid, name));
                newGuids.push(guid);
                break;
            case 'light':
                if (!layer) break;
                layer.lights.push(translatedLight(item.data, item.relative, targetCentre, guid, name));
                newGuids.push(guid);
                break;
            case 'zone':
                map.zones.push(translatedZone(item.data, item.relative, targetCentre, guid, name));
                newGuids.push(guid);
                break;
            case 'navHint':
                map.navHints.push(translatedNavHint(item.data, item.relative, targetCentre, guid, name));
                newGuids.push(guid);
                break;
        }
    }
    return newGuids;
}

function translatedWall(
    data: Omit<Wall, 'id'>,
    relative: Vec2,
    target: Vec2,
    guid: string,
    name: string,
): Wall & { name: string } {
    const cloned: Omit<Wall, 'id'> = JSON.parse(JSON.stringify(data));
    let cx = 0;
    let cy = 0;
    for (const v of cloned.vertices) {
        cx += v.x;
        cy += v.y;
    }
    if (cloned.vertices.length > 0) {
        cx /= cloned.vertices.length;
        cy /= cloned.vertices.length;
    }
    const dx = target.x + relative.x - cx;
    const dy = target.y + relative.y - cy;
    for (const v of cloned.vertices) {
        v.x += dx;
        v.y += dy;
    }
    return { id: guid, ...cloned, name };
}

function translatedPlacement(
    data: Omit<ObjectPlacement, 'id'>,
    relative: Vec2,
    target: Vec2,
    guid: string,
    name: string,
): ObjectPlacement & { name: string } {
    const cloned: Omit<ObjectPlacement, 'id'> = JSON.parse(JSON.stringify(data));
    cloned.position = { x: target.x + relative.x, y: target.y + relative.y };
    return { id: guid, ...cloned, name };
}

function translatedEntity(
    data: Omit<EntityPlacement, 'id'>,
    relative: Vec2,
    target: Vec2,
    guid: string,
    name: string,
): EntityPlacement & { name: string } {
    const cloned: Omit<EntityPlacement, 'id'> = JSON.parse(JSON.stringify(data));
    cloned.position = { x: target.x + relative.x, y: target.y + relative.y };
    return { id: guid, ...cloned, name };
}

function translatedDecal(
    data: Omit<DecalPlacement, 'id'>,
    relative: Vec2,
    target: Vec2,
    guid: string,
    name: string,
): DecalPlacement & { name: string } {
    const cloned: Omit<DecalPlacement, 'id'> = JSON.parse(JSON.stringify(data));
    cloned.position = { x: target.x + relative.x, y: target.y + relative.y };
    return { id: guid, ...cloned, name };
}

function translatedLight(
    data: Omit<LightPlacement, 'id'>,
    relative: Vec2,
    target: Vec2,
    guid: string,
    name: string,
): LightPlacement & { name: string } {
    const cloned: Omit<LightPlacement, 'id'> = JSON.parse(JSON.stringify(data));
    cloned.position = { x: target.x + relative.x, y: target.y + relative.y };
    return { id: guid, ...cloned, name };
}

function translatedZone(
    data: Omit<Zone, 'id'>,
    relative: Vec2,
    target: Vec2,
    guid: string,
    name: string,
): Zone & { name: string } {
    const cloned: Omit<Zone, 'id'> = JSON.parse(JSON.stringify(data));
    const oldCentre = polygonCentre(cloned.polygon);
    const dx = target.x + relative.x - oldCentre.x;
    const dy = target.y + relative.y - oldCentre.y;
    for (const v of cloned.polygon) {
        v.x += dx;
        v.y += dy;
    }
    return { id: guid, ...cloned, name };
}

function translatedNavHint(
    data: Omit<NavHint, 'id'>,
    relative: Vec2,
    target: Vec2,
    guid: string,
    name: string,
): NavHint & { name: string } {
    const cloned: Omit<NavHint, 'id'> = JSON.parse(JSON.stringify(data));
    cloned.position = { x: target.x + relative.x, y: target.y + relative.y };
    return { id: guid, ...cloned, name };
}

function polygonCentre(poly: Vec2[]): Vec2 {
    let x = 0;
    let y = 0;
    for (const v of poly) {
        x += v.x;
        y += v.y;
    }
    if (poly.length === 0) return { x: 0, y: 0 };
    return { x: x / poly.length, y: y / poly.length };
}
