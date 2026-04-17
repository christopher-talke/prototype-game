/**
 * Map validator -- runs before sim instantiation at load, also used by
 * editor compile check. Orchestration layer: the only layer with access
 * to both MapData and (future) sim internals. Phase 1 scope: validates
 * MapData against itself. Registry resolvers join in Phase 2.
 */

import type {
    MapData,
    MapLayer,
    Zone,
    TriggerEvent,
    ObjectPlacement,
    EntityPlacement,
    EntityTypeDefinition,
    Wall,
    Vec2,
    FloorTransitionMeta,
} from '@shared/map/MapData';

export type MapValidationError = {
    path: string;
    field: string;
    message: string;
};

/**
 * Validates a MapData instance. Returns a list of errors; empty means valid.
 * Does not throw.
 */
export function validateMap(map: MapData): MapValidationError[] {
    const errors: MapValidationError[] = [];

    validateBounds(map, errors);
    validateMeta(map, errors);
    validateFloors(map, errors);
    validateLayers(map, errors);
    validateZones(map, errors);
    validateNavHints(map, errors);
    validateSignals(map, errors);

    return errors;
}

function validateBounds(map: MapData, errors: MapValidationError[]): void {
    const b = map.bounds;
    if (!(b.width > 0)) {
        errors.push({ path: 'bounds', field: 'width', message: 'must be > 0' });
    }
    if (!(b.height > 0)) {
        errors.push({ path: 'bounds', field: 'height', message: 'must be > 0' });
    }
    const pa = b.playableArea;
    if (pa.x < 0 || pa.y < 0 || pa.x + pa.width > b.width || pa.y + pa.height > b.height) {
        errors.push({ path: 'bounds.playableArea', field: 'rect', message: 'must lie within world bounds' });
    }
}

function validateMeta(map: MapData, errors: MapValidationError[]): void {
    const pc = map.meta.playerCount;
    if (!Number.isInteger(pc.min) || !Number.isInteger(pc.max) || !Number.isInteger(pc.recommended)) {
        errors.push({ path: 'meta.playerCount', field: 'min/max/recommended', message: 'must be integers' });
    }
    if (pc.min <= 0 || pc.max <= 0 || pc.recommended <= 0) {
        errors.push({ path: 'meta.playerCount', field: 'min/max/recommended', message: 'must be positive' });
    }
    if (!(pc.min <= pc.recommended && pc.recommended <= pc.max)) {
        errors.push({ path: 'meta.playerCount', field: 'ordering', message: 'min <= recommended <= max required' });
    }
}

function validateFloors(map: MapData, errors: MapValidationError[]): void {
    const seen = new Set<number>();
    for (const f of map.floors) {
        if (seen.has(f.renderOrder)) {
            errors.push({ path: `floors.${f.id}`, field: 'renderOrder', message: `duplicate renderOrder ${f.renderOrder}` });
        }
        seen.add(f.renderOrder);
    }
}

function validateLayers(map: MapData, errors: MapValidationError[]): void {
    const floorIds = new Set(map.floors.map((f) => f.id));
    const objectDefIds = new Set(map.objectDefs.map((d) => d.id));
    const entityTypeIds = new Set(map.entityDefs.map((d) => d.id));
    const entityDefById = new Map(map.entityDefs.map((d) => [d.id, d] as const));
    const layerIds = new Set(map.layers.map((l) => l.id));

    for (const layer of map.layers) {
        if (!floorIds.has(layer.floorId)) {
            errors.push({ path: `layers.${layer.id}`, field: 'floorId', message: `unknown floor '${layer.floorId}'` });
        }
        for (const wall of layer.walls) {
            validateWall(layer, wall, errors);
        }
        for (const light of layer.lights) {
            if (!(light.intensity > 0)) {
                errors.push({ path: `layers.${layer.id}.lights.${light.id}`, field: 'intensity', message: 'must be > 0' });
            }
            if (!(light.radius > 0)) {
                errors.push({ path: `layers.${layer.id}.lights.${light.id}`, field: 'radius', message: 'must be > 0' });
            }
        }
        for (const obj of layer.objects) {
            validateObjectPlacement(layer, obj, objectDefIds, errors);
        }
        for (const ent of layer.entities) {
            validateEntityPlacement(layer, ent, entityTypeIds, entityDefById, layerIds, map, errors);
        }
    }

    for (const def of map.objectDefs) {
        for (const l of def.lights) {
            if (!(l.intensity > 0)) {
                errors.push({ path: `objectDefs.${def.id}.lights`, field: 'intensity', message: 'must be > 0' });
            }
            if (!(l.radius > 0)) {
                errors.push({ path: `objectDefs.${def.id}.lights`, field: 'radius', message: 'must be > 0' });
            }
        }
    }
}

function validateWall(layer: MapLayer, wall: Wall, errors: MapValidationError[]): void {
    const v = wall.vertices;
    if (v.length < 3) {
        errors.push({ path: `layers.${layer.id}.walls.${wall.id}`, field: 'vertices', message: 'need at least 3 vertices for polygon' });
        return;
    }
    const bad = findConcaveVertex(v);
    if (bad !== -1) {
        errors.push({ path: `layers.${layer.id}.walls.${wall.id}`, field: `vertices[${bad}]`, message: 'polygon is not convex' });
    }
}

function findConcaveVertex(v: Vec2[]): number {
    let sign = 0;
    const n = v.length;
    for (let i = 0; i < n; i++) {
        const a = v[i];
        const b = v[(i + 1) % n];
        const c = v[(i + 2) % n];
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (cross !== 0) {
            const s = cross > 0 ? 1 : -1;
            if (sign === 0) {
                sign = s;
            } else if (s !== sign) {
                return (i + 1) % n;
            }
        }
    }
    return -1;
}

function validateObjectPlacement(
    layer: MapLayer,
    obj: ObjectPlacement,
    objectDefIds: Set<string>,
    errors: MapValidationError[],
): void {
    if (!objectDefIds.has(obj.objectDefId)) {
        errors.push({
            path: `layers.${layer.id}.objects.${obj.id}`,
            field: 'objectDefId',
            message: `unknown objectDefId '${obj.objectDefId}' (Phase 1: only local defs resolved)`,
        });
    }
}

function validateEntityPlacement(
    layer: MapLayer,
    ent: EntityPlacement,
    entityTypeIds: Set<string>,
    entityDefById: Map<string, EntityTypeDefinition>,
    layerIds: Set<string>,
    map: MapData,
    errors: MapValidationError[],
): void {
    if (!entityTypeIds.has(ent.entityTypeId)) {
        errors.push({
            path: `layers.${layer.id}.entities.${ent.id}`,
            field: 'entityTypeId',
            message: `unknown entityTypeId '${ent.entityTypeId}' (Phase 1: only local defs resolved)`,
        });
        return;
    }
    const def = entityDefById.get(ent.entityTypeId)!;
    if (!def.stateSchema) return;

    const signalIds = new Set(map.signals.map((s) => s.id));
    const allEntityIds = new Set<string>();
    for (const l of map.layers) {
        for (const e of l.entities) allEntityIds.add(e.id);
    }

    for (const [fieldName, descriptor] of Object.entries(def.stateSchema)) {
        const value = ent.initialState[fieldName];
        if (value === undefined) continue;
        switch (descriptor.type) {
            case 'layerId':
                if (typeof value !== 'string' || !layerIds.has(value)) {
                    errors.push({
                        path: `layers.${layer.id}.entities.${ent.id}.initialState`,
                        field: fieldName,
                        message: `layerId '${value}' not found in map layers`,
                    });
                }
                break;
            case 'entityId':
                if (typeof value !== 'string' || !allEntityIds.has(value)) {
                    errors.push({
                        path: `layers.${layer.id}.entities.${ent.id}.initialState`,
                        field: fieldName,
                        message: `entityId '${value}' not found in map`,
                    });
                }
                break;
            case 'signalId':
                if (typeof value !== 'string' || !signalIds.has(value)) {
                    errors.push({
                        path: `layers.${layer.id}.entities.${ent.id}.initialState`,
                        field: fieldName,
                        message: `signalId '${value}' not found in signal registry`,
                    });
                }
                break;
            case 'teamId':
                if (typeof value !== 'string' || value.length === 0) {
                    errors.push({
                        path: `layers.${layer.id}.entities.${ent.id}.initialState`,
                        field: fieldName,
                        message: `teamId must be non-empty string`,
                    });
                }
                break;
            case 'primitive':
                break;
        }
    }
}

function validateZones(map: MapData, errors: MapValidationError[]): void {
    const floorIds = new Set(map.floors.map((f) => f.id));
    const signalIds = new Set(map.signals.map((s) => s.id));

    for (const zone of map.zones) {
        if (zone.floorId !== undefined && !floorIds.has(zone.floorId)) {
            errors.push({ path: `zones.${zone.id}`, field: 'floorId', message: `unknown floor '${zone.floorId}'` });
        }
        if (zone.type === 'floor-transition') {
            validateFloorTransitionZone(zone, floorIds, errors);
        }
        if (zone.type === 'trigger') {
            validateTriggerZone(zone, signalIds, errors);
        }
    }
}

function validateFloorTransitionZone(zone: Zone, floorIds: Set<string>, errors: MapValidationError[]): void {
    const meta = zone.meta as FloorTransitionMeta | undefined;
    if (!meta || !meta.fromFloorId || !meta.toFloorId) {
        errors.push({ path: `zones.${zone.id}`, field: 'meta', message: 'floor-transition requires FloorTransitionMeta' });
        return;
    }
    if (!floorIds.has(meta.fromFloorId)) {
        errors.push({ path: `zones.${zone.id}`, field: 'meta.fromFloorId', message: `unknown floor '${meta.fromFloorId}'` });
    }
    if (!floorIds.has(meta.toFloorId)) {
        errors.push({ path: `zones.${zone.id}`, field: 'meta.toFloorId', message: `unknown floor '${meta.toFloorId}'` });
    }
}

function validateTriggerZone(zone: Zone, signalIds: Set<string>, errors: MapValidationError[]): void {
    const meta = zone.meta as { events?: TriggerEvent[] } | undefined;
    const events = meta?.events ?? [];
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const evPath = `zones.${zone.id}.meta.events[${i}]`;
        if (!signalIds.has(ev.signal)) {
            errors.push({ path: evPath, field: 'signal', message: `unknown signal '${ev.signal}'` });
        }
        if (ev.target === 'team' && (!ev.teamId || ev.teamId.length === 0)) {
            errors.push({ path: evPath, field: 'teamId', message: `target='team' requires non-empty teamId` });
        }
        if (ev.timeout !== null && !(ev.timeout > 0)) {
            errors.push({ path: evPath, field: 'timeout', message: 'must be null or > 0' });
        }
    }
}

function validateNavHints(map: MapData, errors: MapValidationError[]): void {
    for (const h of map.navHints) {
        if (h.weight < 0 || h.weight > 1) {
            errors.push({ path: `navHints.${h.id}`, field: 'weight', message: 'must be in [0,1]' });
        }
    }
}

function validateSignals(_map: MapData, _errors: MapValidationError[]): void {
    // No per-signal structural checks beyond presence in registry (checked at ref sites).
}
