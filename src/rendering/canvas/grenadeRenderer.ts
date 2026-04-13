import { Graphics } from 'pixi.js';
import { grenadeLayer } from './sceneGraph';

const GRENADE_RADIUS = 6;

const GRENADE_COLORS: Record<GrenadeType, number> = {
    FRAG: 0x2ed573,
    FLASH: 0xffffff,
    SMOKE: 0xaaaaaa,
    C4: 0xff4757,
};

const grenadeGraphics = new Map<number, Graphics>();

export function onPixiGrenadeSpawn(grenadeId: number, grenadeType: GrenadeType, x: number, y: number, _isC4: boolean) {
    const color = GRENADE_COLORS[grenadeType] ?? 0xffffff;
    const g = new Graphics();
    g.circle(0, 0, GRENADE_RADIUS).fill({ color, alpha: 0.9 });
    g.circle(0, 0, GRENADE_RADIUS).stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
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
