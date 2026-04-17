/**
 * Per-floor physics compiler -- Phase 2a of the v1.5 map migration.
 *
 * Layer: orchestration. Reads canonical `MapData` and emits per-floor
 * `SpatialHash` structures keyed by `floorId`. Pure: never mutates input.
 *
 * Consumers (player collision, projectile broad-phase, future dynamic entity
 * registry) query by the player's current `floorId`, guaranteeing cross-floor
 * geometry never participates in the wrong floor's queries.
 */

import type { MapData, Wall, Vec2, CollisionShape } from '@shared/map/MapData';
import { SpatialHash, type AABB } from '@simulation/environment/spatialHash';
import type { ObjectDefRegistry } from './objectDefRegistry';

/** Collision-relevant bundle for a single placed wall -- Wall ref + its world AABB. */
export interface PlacedWall {
    wall: Wall;
    aabb: AABB;
}

/** Collision-relevant bundle for an object placement's resolved shape in world space. */
export interface PlacedShape {
    placementId: string;
    shape: CollisionShape;
    worldAABB: AABB;
}

/** Physics cell size. Roughly 1 wall-length per cell for typical maps. */
export const PHYSICS_CELL_SIZE = 256;

/** Layer types whose walls participate in collision. `object` layers contribute via object defs (see compileObjectShapes). */
const COLLISION_LAYER_TYPES = new Set(['collision', 'ceiling']);

/** Compute the axis-aligned bounding box of a convex wall's vertex list. */
export function wallAABB(wall: Wall): AABB {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const v of wall.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Builds a per-floor `SpatialHash<PlacedWall>` from the map's collision/ceiling
 * layers. Every `floorId` declared in `map.floors` gets an entry, even if the
 * floor has zero walls, so callers can index without null-check branches.
 */
export function compileWalls(map: MapData): Map<string, SpatialHash<PlacedWall>> {
    const byFloor = new Map<string, SpatialHash<PlacedWall>>();

    for (const floor of map.floors) {
        byFloor.set(floor.id, new SpatialHash<PlacedWall>(PHYSICS_CELL_SIZE));
    }

    for (const layer of map.layers) {
        if (!COLLISION_LAYER_TYPES.has(layer.type)) continue;

        const hash = byFloor.get(layer.floorId);
        if (!hash) continue;

        for (const wall of layer.walls) {
            const aabb = wallAABB(wall);
            hash.insert(aabb, { wall, aabb });
        }
    }

    return byFloor;
}

/**
 * Builds a per-floor `SpatialHash<PlacedShape>` from `object` layers, resolving
 * each `ObjectPlacement` through `registry` and transforming its collision
 * shape by the placement's `position`, `rotation`, and `scale`.
 *
 * Placements whose resolved definition has `collisionShape: null` are skipped.
 */
export function compileObjectShapes(
    map: MapData,
    registry: ObjectDefRegistry,
): Map<string, SpatialHash<PlacedShape>> {
    const byFloor = new Map<string, SpatialHash<PlacedShape>>();

    for (const floor of map.floors) {
        byFloor.set(floor.id, new SpatialHash<PlacedShape>(PHYSICS_CELL_SIZE));
    }

    for (const layer of map.layers) {
        if (layer.type !== 'object') continue;

        const hash = byFloor.get(layer.floorId);
        if (!hash) continue;

        for (const placement of layer.objects) {
            const def = registry.resolve(placement.objectDefId);
            if (!def.collisionShape) continue;

            const shape = transformShape(def.collisionShape, placement.position, placement.rotation, placement.scale);
            const worldAABB = shapeAABB(shape);
            hash.insert(worldAABB, {
                placementId: placement.id,
                shape,
                worldAABB,
            });
        }
    }

    return byFloor;
}

/**
 * Transforms a local-space `CollisionShape` into world space by applying
 * position, rotation (radians), and scale. Returns a new shape -- input is
 * never mutated.
 */
export function transformShape(
    shape: CollisionShape,
    position: Vec2,
    rotation: number,
    scale: Vec2,
): CollisionShape {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    switch (shape.type) {
        case 'aabb': {
            // AABB (x,y) is the local-space top-left. Unrotated: translate in place
            // and stay AABB. Rotated: emit as polygon so downstream shape handling
            // has a uniform representation for arbitrary orientations.
            const local: Vec2[] = [
                { x: shape.x, y: shape.y },
                { x: shape.x + shape.width, y: shape.y },
                { x: shape.x + shape.width, y: shape.y + shape.height },
                { x: shape.x, y: shape.y + shape.height },
            ];
            const vertices = local.map((p) =>
                rotateAndTranslate({ x: p.x * scale.x, y: p.y * scale.y }, cos, sin, position),
            );
            if (rotation === 0) {
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;
                for (const v of vertices) {
                    if (v.x < minX) minX = v.x;
                    if (v.y < minY) minY = v.y;
                    if (v.x > maxX) maxX = v.x;
                    if (v.y > maxY) maxY = v.y;
                }
                return { type: 'aabb', x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }
            return { type: 'polygon', vertices };
        }
        case 'polygon': {
            const vertices = shape.vertices.map((v) =>
                rotateAndTranslate({ x: v.x * scale.x, y: v.y * scale.y }, cos, sin, position),
            );
            return { type: 'polygon', vertices };
        }
        case 'circle': {
            // Non-uniform scale on a circle is undefined; take the max to stay conservative
            // (keeps collision checks from missing geometry under stretched placements).
            const scaleMax = Math.max(Math.abs(scale.x), Math.abs(scale.y));
            const center = rotateAndTranslate(
                { x: shape.center.x * scale.x, y: shape.center.y * scale.y },
                cos,
                sin,
                position,
            );
            return { type: 'circle', center, radius: shape.radius * scaleMax };
        }
    }
}

/** World-space AABB of a compiled shape (polygon/aabb/circle). */
export function shapeAABB(shape: CollisionShape): AABB {
    switch (shape.type) {
        case 'aabb':
            return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
        case 'polygon': {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (const v of shape.vertices) {
                if (v.x < minX) minX = v.x;
                if (v.y < minY) minY = v.y;
                if (v.x > maxX) maxX = v.x;
                if (v.y > maxY) maxY = v.y;
            }
            return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }
        case 'circle':
            return {
                x: shape.center.x - shape.radius,
                y: shape.center.y - shape.radius,
                w: shape.radius * 2,
                h: shape.radius * 2,
            };
    }
}

function rotateAndTranslate(p: Vec2, cos: number, sin: number, origin: Vec2): Vec2 {
    return {
        x: p.x * cos - p.y * sin + origin.x,
        y: p.x * sin + p.y * cos + origin.y,
    };
}
