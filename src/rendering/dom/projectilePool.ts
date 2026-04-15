/**
 * Pre-allocated DOM element pool for projectile (bullet) visuals.
 * Avoids per-shot createElement/removeChild overhead by hiding and reusing
 * div elements. Grows on demand up to MAX_PROJECTILES.
 * Part of the DOM rendering layer.
 */

import { app } from '../../app';

const INITIAL_POOL_SIZE = 64;
const MAX_PROJECTILES = 512;
const poolElements: HTMLElement[] = [];
const freeStack: number[] = [];

function allocateElements(count: number) {
    if (app === undefined) return;

    const start = poolElements.length;
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.classList.add('projectile');
        el.style.display = 'none';
        app.appendChild(el);

        const idx = start + i;
        poolElements.push(el);
        freeStack.push(idx);
    }
}

/**
 * Creates the initial pool of hidden projectile elements.
 * Must be called once during game initialization after the app element exists.
 */
export function initProjectilePool() {
    allocateElements(INITIAL_POOL_SIZE);
}

/**
 * Takes a projectile element from the pool and makes it visible.
 * Grows the pool if empty and capacity allows.
 * @param weaponType - Optional weapon type to apply variant CSS class (e.g. sniper, shrapnel)
 * @returns The acquired element and its pool index, or null if the pool is exhausted
 */
export function acquireProjectile(weaponType?: string): { element: HTMLElement; poolIndex: number } | null {
    if (freeStack.length === 0) {
        if (poolElements.length >= MAX_PROJECTILES) return null;

        const grow = Math.min(poolElements.length, MAX_PROJECTILES - poolElements.length);
        if (grow <= 0) return null;

        allocateElements(grow);
    }

    const poolIndex = freeStack.pop()!;
    const element = poolElements[poolIndex];
    element.style.display = '';

    if (weaponType === 'SNIPER') element.classList.add('projectile-sniper');

    else if (weaponType === 'SHRAPNEL') element.classList.add('projectile-shrapnel');

    return { element, poolIndex };
}

/**
 * Returns a projectile element to the pool, hiding it and clearing variant classes.
 * @param poolIndex - The index returned from acquireProjectile
 */
export function releaseProjectile(poolIndex: number) {
    const element = poolElements[poolIndex];
    element.style.display = 'none';
    element.classList.remove('projectile-sniper', 'projectile-shrapnel');
    freeStack.push(poolIndex);
}
