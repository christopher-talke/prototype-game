/**
 * Fog of war stub.
 *
 * The lighting shader (lightingManager.ts) now handles all scene darkening.
 * Enemy/terrain hiding outside LOS is handled by applyPixiVisibility in playerRenderer.ts.
 * These no-op exports preserve the public API for the render pipeline.
 */

export function initPixiFogOfWar() {}
export function updatePixiFogOfWar(_vertices: coordinates[], _count: number) {}
export function hidePixiFog() {}
