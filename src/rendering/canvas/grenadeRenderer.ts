/**
 * Grenade sprite lifecycle manager.
 *
 * Creates, positions, and destroys PixiJS Graphics for in-flight grenades.
 * Explosion visuals are handled by the per-type effect modules
 * (fragEffect.ts, c4Effect.ts, etc.).
 *
 * Part of the canvas rendering layer.
 */

import { Graphics } from 'pixi.js';

import { grenadeLayer } from './sceneGraph';
import { GRENADE_VFX } from '@simulation/combat/grenades';

const grenadeGraphics = new Map<number, Graphics>();

/**
 * Create a grenade sprite and add it to the grenade scene layer.
 * @param grenadeId - Unique grenade instance ID from the simulation.
 * @param grenadeType - Grenade type key used to look up VFX sprite definition.
 * @param x - Initial world X position.
 * @param y - Initial world Y position.
 * @param _isC4 - Whether the grenade is a C4 charge (unused here, consumed by effect modules).
 */
export function onPixiGrenadeSpawn(grenadeId: number, grenadeType: GrenadeType, x: number, y: number, _isC4: boolean) {
    const sprite = GRENADE_VFX[grenadeType].sprite;
    const g = new Graphics();
    g.circle(0, 0, sprite.radius).fill({ color: sprite.color, alpha: sprite.fillAlpha });
    g.circle(0, 0, sprite.radius).stroke({ color: sprite.strokeColor, width: sprite.strokeWidth, alpha: sprite.strokeAlpha });
    g.x = x;
    g.y = y;
    g.cullable = true;
    grenadeLayer.addChild(g);
    grenadeGraphics.set(grenadeId, g);
}

/**
 * Destroy and untrack a grenade sprite.
 * @param grenadeId - Unique grenade instance ID.
 */
export function onPixiGrenadeRemoved(grenadeId: number) {
    const g = grenadeGraphics.get(grenadeId);
    if (g) {
        g.destroy();
        grenadeGraphics.delete(grenadeId);
    }
}

/**
 * Sync all tracked grenade sprite positions to their simulation state.
 * Detonated grenades are skipped (their sprite is removed on detonation).
 * @param grenades - Current grenade positions from the simulation.
 */
export function updatePixiGrenadePositions(grenades: readonly { id: number; x: number; y: number; detonated: boolean }[]) {
    for (const gr of grenades) {
        const g = grenadeGraphics.get(gr.id);
        if (g && !gr.detonated) {
            g.x = gr.x;
            g.y = gr.y;
        }
    }
}

/** Destroy all grenade sprites and clear internal tracking state. */
export function clearPixiGrenades() {
    for (const [, g] of grenadeGraphics) g.destroy();
    grenadeGraphics.clear();
}
