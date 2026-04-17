/**
 * Per-floor renderer compiler -- Phase 2b of the v1.5 map migration.
 *
 * Layer: orchestration. Bridges canonical `MapData` to rendering primitives
 * (sprite placements, world-space lights) without importing PixiJS. Pure:
 * never mutates input.
 *
 * Two outputs:
 *  - `CompiledObject[]` -- each `ObjectPlacement` resolved through the registry
 *    with sprites passed through, lights transformed into world space, tagged
 *    with the containing layer's `floorId`.
 *  - `CompiledLight[]` -- standalone layer lights (already world-space) plus
 *    every object-attached light in world space, unified for the lighting
 *    manager consumer.
 */

import type {
    MapData,
    LightPlacement,
    LightSourceDef,
    SpriteLayer,
    Vec2,
} from '@shared/map/MapData';
import type { ObjectDefRegistry } from './objectDefRegistry';

/** Compiled world-space object placement: resolved sprites, transforms, and lights. */
export interface CompiledObject {
    placementId: string;
    floorId: string;
    worldPosition: Vec2;
    worldRotation: number;
    scale: Vec2;
    pivot: Vec2;
    sprites: readonly SpriteLayer[];
    lights: CompiledLight[];
}

/**
 * World-space light ready for direct consumption by `lightingManager.initLighting`.
 * Shape matches `LightPlacement` plus a floorId tag for future per-floor dimming
 * (uniform contribution in Phase 2b; per-floor wiring lands with 2e).
 */
export interface CompiledLight extends LightPlacement {
    floorId: string;
}

/**
 * Transforms an object's `LightSourceDef` into world space using the placement's
 * position + rotation. Scale is not applied to light radius (design choice:
 * object scale stretches geometry but lights stay at their def-specified reach).
 */
function transformLight(
    def: LightSourceDef,
    index: number,
    placementId: string,
    floorId: string,
    placementPosition: Vec2,
    placementRotation: number,
): CompiledLight {
    const cos = Math.cos(placementRotation);
    const sin = Math.sin(placementRotation);
    return {
        id: `${placementId}__${index}`,
        floorId,
        position: {
            x: def.offset.x * cos - def.offset.y * sin + placementPosition.x,
            y: def.offset.x * sin + def.offset.y * cos + placementPosition.y,
        },
        color: def.color,
        intensity: def.intensity,
        radius: def.radius,
        coneAngle: def.coneAngle,
        coneDirection: placementRotation + def.coneDirection,
        castShadows: def.castShadows,
    };
}

/**
 * Compiles every `ObjectPlacement` in every `'object'` layer. Resolves
 * `objectDefId` through `registry`; throws if any id is unresolved.
 */
export function compileObjectPlacements(map: MapData, registry: ObjectDefRegistry): CompiledObject[] {
    const out: CompiledObject[] = [];
    for (const layer of map.layers) {
        if (layer.type !== 'object') continue;
        for (const placement of layer.objects) {
            const def = registry.resolve(placement.objectDefId);
            const lights = def.lights.map((l, i) =>
                transformLight(l, i, placement.id, layer.floorId, placement.position, placement.rotation),
            );
            out.push({
                placementId: placement.id,
                floorId: layer.floorId,
                worldPosition: placement.position,
                worldRotation: placement.rotation,
                scale: placement.scale,
                pivot: def.pivot,
                sprites: def.sprites,
                lights,
            });
        }
    }
    return out;
}

/**
 * Collects every standalone layer light (already world-space) as `CompiledLight`,
 * tagged with the containing layer's floorId.
 */
export function compileStandaloneLights(map: MapData): CompiledLight[] {
    const out: CompiledLight[] = [];
    for (const layer of map.layers) {
        for (const l of layer.lights) {
            out.push({ ...l, floorId: layer.floorId });
        }
    }
    return out;
}

/**
 * Convenience: union of all compiled lights (standalone + object-attached)
 * ready for `lightingManager.initLighting`.
 */
export function compileAllLights(map: MapData, registry: ObjectDefRegistry): CompiledLight[] {
    const standalone = compileStandaloneLights(map);
    const objects = compileObjectPlacements(map, registry);
    for (const obj of objects) {
        for (const l of obj.lights) standalone.push(l);
    }
    return standalone;
}
