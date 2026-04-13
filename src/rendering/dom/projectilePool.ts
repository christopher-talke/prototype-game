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

export function initProjectilePool() {
    allocateElements(INITIAL_POOL_SIZE);
}

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

export function releaseProjectile(poolIndex: number) {
    const element = poolElements[poolIndex];
    element.style.display = 'none';
    element.classList.remove('projectile-sniper', 'projectile-shrapnel');
    freeStack.push(poolIndex);
}
