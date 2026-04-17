/**
 * Live representation of a `MapData.EntityPlacement`. Simulation-layer type:
 * owns per-instance mutable state, floor binding, and the resolved collision
 * shape from its type definition.
 */

import type { CollisionShape, Vec2 } from '@shared/map/MapData';

export interface EntityInstance {
    id: string;
    typeId: string;
    floorId: string;
    position: Vec2;
    rotation: number;
    state: Record<string, unknown>;
    collisionShape: CollisionShape | null;
    interactionRadius: number;
}

/**
 * Convention for Phase 2c: an entity contributes collision unless its state
 * explicitly disables it via `open === true` or `destroyed === true`. Entity
 * types that need richer rules register per-type predicates in a future phase.
 */
export function entityBlocksCollision(ent: EntityInstance): boolean {
    if (ent.collisionShape === null) return false;
    if (ent.state.open === true) return false;
    if (ent.state.destroyed === true) return false;
    return true;
}

/**
 * Convention for Phase 2c: an entity occludes vision when
 * `state.occludesVision === true`, or defaults to `true` when the field is
 * absent AND the entity has a collision shape (walls-in-disguise).
 */
export function entityOccludesVision(ent: EntityInstance): boolean {
    const flag = ent.state.occludesVision;
    if (typeof flag === 'boolean') return flag;
    return ent.collisionShape !== null && ent.state.open !== true && ent.state.destroyed !== true;
}
