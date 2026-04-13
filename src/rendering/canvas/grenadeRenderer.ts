import { Graphics } from 'pixi.js';
import { grenadeLayer } from './sceneGraph';
import { GRENADE_VFX } from '@simulation/combat/grenades';

const grenadeGraphics = new Map<number, Graphics>();

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

// Explosion visuals are now handled by effect modules (fragEffect.ts, c4Effect.ts)

export function onPixiGrenadeRemoved(grenadeId: number) {
    const g = grenadeGraphics.get(grenadeId);
    if (g) {
        g.destroy();
        grenadeGraphics.delete(grenadeId);
    }
}

export function updatePixiGrenadePositions(grenades: readonly { id: number; x: number; y: number; detonated: boolean }[]) {
    for (const gr of grenades) {
        const g = grenadeGraphics.get(gr.id);
        if (g && !gr.detonated) {
            g.x = gr.x;
            g.y = gr.y;
        }
    }
}

export function clearPixiGrenades() {
    for (const [, g] of grenadeGraphics) g.destroy();
    grenadeGraphics.clear();
}
