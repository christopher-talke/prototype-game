import { Graphics } from 'pixi.js';
import { projectileLayer } from './sceneGraph';

const INITIAL_POOL_SIZE = 64;
const MAX_PROJECTILES = 512;
const poolGraphics: Graphics[] = [];
const freeStack: number[] = [];

function allocateGraphics(count: number) {
    const start = poolGraphics.length;
    for (let i = 0; i < count; i++) {
        const g = new Graphics();
        g.circle(0, 0, 3).fill(0xffffff);
        g.visible = false;
        g.blendMode = 'add';
        projectileLayer.addChild(g);
        poolGraphics.push(g);
        freeStack.push(start + i);
    }
}

export function initPixiProjectilePool() {
    allocateGraphics(INITIAL_POOL_SIZE);
}

export function acquirePixiProjectile(weaponType?: string): { graphic: Graphics; poolIndex: number } | null {
    if (freeStack.length === 0) {
        if (poolGraphics.length >= MAX_PROJECTILES) return null;
        const grow = Math.min(poolGraphics.length, MAX_PROJECTILES - poolGraphics.length);
        if (grow <= 0) return null;
        allocateGraphics(grow);
    }
    const poolIndex = freeStack.pop()!;
    const graphic = poolGraphics[poolIndex];
    graphic.visible = true;
    if (weaponType === 'SNIPER') {
        graphic.tint = 0xffffff;
        graphic.scale.set(2);
    } else if (weaponType === 'SHRAPNEL') {
        graphic.tint = 0xff6600;
        graphic.scale.set(0.67);
    } else {
        graphic.tint = 0xffcc00;
        graphic.scale.set(1);
    }
    return { graphic, poolIndex };
}

export function releasePixiProjectile(poolIndex: number) {
    const g = poolGraphics[poolIndex];
    g.visible = false;
    g.tint = 0xffffff;
    g.scale.set(1);
    freeStack.push(poolIndex);
}
