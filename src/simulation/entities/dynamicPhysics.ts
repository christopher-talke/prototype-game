/**
 * Dynamic collision query for `EntityInstance`s. Simulation layer. Linear
 * scan per floor; sufficient for Phase 2c's expected entity counts. Can be
 * lifted to a spatial hash when measured load requires it.
 */

import type { CollisionShape, Vec2 } from '@shared/map/MapData';
import type { AABB } from '@simulation/environment/spatialHash';
import { shapeWorldAABB, pointInsideShape } from '@simulation/environment/shapeMath';
import type { EntityRegistry } from './entityRegistry';
import { entityBlocksCollision } from './entityInstance';

/** World-space collision probe: does `point` lie inside any collidable entity on `floorId`? */
export function pointInsideEntityOnFloor(
    registry: EntityRegistry,
    floorId: string,
    point: Vec2,
): boolean {
    for (const ent of registry.getByFloor(floorId)) {
        if (!entityBlocksCollision(ent)) continue;
        if (ent.collisionShape === null) continue;
        if (pointInsideShape(ent.collisionShape, ent.position, ent.rotation, point)) return true;
    }
    return false;
}

/** Returns world-space AABBs for every currently collidable entity on `floorId`. */
export function collectEntityAABBs(registry: EntityRegistry, floorId: string): AABB[] {
    const out: AABB[] = [];
    for (const ent of registry.getByFloor(floorId)) {
        if (!entityBlocksCollision(ent)) continue;
        if (ent.collisionShape === null) continue;
        out.push(shapeWorldAABB(ent.collisionShape, ent.position, ent.rotation));
    }
    return out;
}

/** Lightweight readonly snapshot of an entity's collision geometry. */
export interface EntityShapeView {
    id: string;
    shape: CollisionShape;
    position: Vec2;
    rotation: number;
}

/** Iterates every collidable entity on `floorId` as a shape view. */
export function collidableEntitiesOnFloor(registry: EntityRegistry, floorId: string): EntityShapeView[] {
    const out: EntityShapeView[] = [];
    for (const ent of registry.getByFloor(floorId)) {
        if (!entityBlocksCollision(ent)) continue;
        if (ent.collisionShape === null) continue;
        out.push({ id: ent.id, shape: ent.collisionShape, position: ent.position, rotation: ent.rotation });
    }
    return out;
}
