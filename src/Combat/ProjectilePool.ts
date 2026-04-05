import { app } from '../main';

const MAX_PROJECTILES = 512;
const poolElements: HTMLElement[] = [];
const freeStack: number[] = [];

export function initProjectilePool() {
    for (let i = 0; i < MAX_PROJECTILES; i++) {
        const el = document.createElement('div');
        el.classList.add('projectile');
        el.style.display = 'none';
        app.appendChild(el);
        poolElements.push(el);
        freeStack.push(i);
    }
}

export function acquireProjectile(isSniper: boolean): { element: HTMLElement; poolIndex: number } | null {
    if (freeStack.length === 0) return null;
    const poolIndex = freeStack.pop()!;
    const element = poolElements[poolIndex];
    element.style.display = '';
    if (isSniper) element.classList.add('projectile-sniper');
    return { element, poolIndex };
}

export function releaseProjectile(poolIndex: number) {
    const element = poolElements[poolIndex];
    element.style.display = 'none';
    element.classList.remove('projectile-sniper');
    freeStack.push(poolIndex);
}
