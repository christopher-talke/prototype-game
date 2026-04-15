/**
 * Object pool for bullet (projectile) PixiJS Graphics.
 *
 * Pre-allocates a configurable number of circle Graphics and grows on demand
 * up to a hard cap. Acquired sprites are tinted and scaled per weapon VFX.
 * Released sprites are hidden and returned to the free stack.
 *
 * Part of the canvas rendering layer. Consumed by {@link clientRenderer}.
 */

import { Graphics } from 'pixi.js';

import { projectileLayer } from './sceneGraph';
import { getGraphicsConfig } from './config/graphicsConfig';
import { getWeaponVfx, DEFAULT_WEAPON_VFX } from '@simulation/combat/weapons';

const poolGraphics: Graphics[] = [];
const freeStack: number[] = [];

/**
 * Create `count` new bullet Graphics, add them to the projectile layer,
 * and push their indices onto the free stack.
 */
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

/** Allocate the initial pool of projectile graphics. Call once during renderer init. */
export function initPixiProjectilePool() {
    allocateGraphics(getGraphicsConfig().pools.projectileInitial);
}

/**
 * Acquire a projectile graphic from the pool, applying weapon-specific tint and scale.
 * Grows the pool if empty (up to the configured max).
 * @param weaponType - Weapon type key for VFX lookup. Falls back to defaults if omitted.
 * @returns The graphic and its pool index, or null if the pool is at capacity.
 */
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

/**
 * Return a projectile graphic to the pool, hiding it and resetting tint/scale.
 * @param poolIndex - The index returned by {@link acquirePixiProjectile}.
 */
export function releasePixiProjectile(poolIndex: number) {
    const g = poolGraphics[poolIndex];
    g.visible = false;
    g.tint = 0xffffff;
    g.scale.set(1);
    freeStack.push(poolIndex);
}
