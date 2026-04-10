import { Graphics, Ticker } from 'pixi.js';
import { grenadeLayer, explosionLayer } from './sceneGraph';

const GRENADE_RADIUS = 6;
const EXPLOSION_DURATION = 500;

const GRENADE_COLORS: Record<GrenadeType, number> = {
    FRAG: 0x2ed573,
    FLASH: 0xffffff,
    SMOKE: 0xaaaaaa,
    C4: 0xff4757,
};

interface ExplosionEntry {
    g: Graphics;
    elapsed: number;
    isC4: boolean;
}

const grenadeGraphics = new Map<number, Graphics>();
const activeExplosions: ExplosionEntry[] = [];

Ticker.shared.add((ticker) => {
    for (let i = activeExplosions.length - 1; i >= 0; i--) {
        const entry = activeExplosions[i];
        entry.elapsed += ticker.deltaMS;
        const t = Math.min(1, entry.elapsed / EXPLOSION_DURATION);
        entry.g.scale.set(0.1 + 0.9 * t);
        entry.g.alpha = 1 - t;
        if (t >= 1) {
            entry.g.destroy();
            activeExplosions.splice(i, 1);
        }
    }
});

export function onPixiGrenadeSpawn(grenadeId: number, grenadeType: GrenadeType, x: number, y: number, _isC4: boolean) {
    const color = GRENADE_COLORS[grenadeType] ?? 0xffffff;
    const g = new Graphics();
    g.circle(0, 0, GRENADE_RADIUS).fill({ color, alpha: 0.9 });
    g.circle(0, 0, GRENADE_RADIUS).stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
    g.x = x;
    g.y = y;
    grenadeLayer.addChild(g);
    grenadeGraphics.set(grenadeId, g);
}

export function onPixiGrenadeDetonate(_grenadeId: number, grenadeType: GrenadeType, x: number, y: number, radius: number) {
    if (grenadeType !== 'FRAG' && grenadeType !== 'C4') return;

    const isC4 = grenadeType === 'C4';
    const color = isC4 ? 0xff6b35 : 0xff9500;
    const ring = new Graphics();
    ring.circle(0, 0, radius).stroke({ color, width: 3 });
    ring.x = x;
    ring.y = y;
    ring.scale.set(0.1);
    ring.alpha = 1;
    ring.blendMode = 'add';
    explosionLayer.addChild(ring);
    activeExplosions.push({ g: ring, elapsed: 0, isC4 });
}

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
    for (const entry of activeExplosions) entry.g.destroy();
    activeExplosions.length = 0;
}
