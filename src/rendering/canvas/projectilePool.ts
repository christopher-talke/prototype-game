import { Graphics } from 'pixi.js';
import { projectileLayer } from './sceneGraph';
import { getGraphicsConfig } from './config/graphicsConfig';
import { getWeaponVfx, DEFAULT_WEAPON_VFX } from '@simulation/combat/weapons';

const poolGraphics: Graphics[] = [];
const freeStack: number[] = [];

function allocateGraphics(count: number) {
    const start = poolGraphics.length;
    for (let i = 0; i < count; i++) {
        const g = new Graphics();
        g.circle(0, 0, DEFAULT_WEAPON_VFX.projectile.baseRadius).fill(0xffffff);
        g.visible = false;
        g.blendMode = DEFAULT_WEAPON_VFX.projectile.blendMode as any;
        g.cullable = true;
        projectileLayer.addChild(g);
        poolGraphics.push(g);
        freeStack.push(start + i);
    }
}

export function initPixiProjectilePool() {
    allocateGraphics(getGraphicsConfig().pools.projectileInitial);
}

export function acquirePixiProjectile(weaponType?: string): { graphic: Graphics; poolIndex: number } | null {
    if (freeStack.length === 0) {
        const max = getGraphicsConfig().pools.projectileMax;
        if (poolGraphics.length >= max) return null;
        const grow = Math.min(poolGraphics.length, max - poolGraphics.length);
        if (grow <= 0) return null;
        allocateGraphics(grow);
    }
    const poolIndex = freeStack.pop()!;
    const graphic = poolGraphics[poolIndex];
    graphic.visible = true;
    const wvfx = getWeaponVfx(weaponType);
    graphic.tint = wvfx.projectile.tint;
    graphic.scale.set(wvfx.projectile.scale);
    return { graphic, poolIndex };
}

export function releasePixiProjectile(poolIndex: number) {
    const g = poolGraphics[poolIndex];
    g.visible = false;
    g.tint = 0xffffff;
    g.scale.set(1);
    freeStack.push(poolIndex);
}
