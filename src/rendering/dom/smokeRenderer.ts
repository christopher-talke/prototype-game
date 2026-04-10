import { app } from '../../app';

type SmokeCloud = {
    x: number;
    y: number;
    radius: number;
    expiresAt: number;
    fadeStart: number;
    element: HTMLElement;
    fading: boolean;
};

const FADE_DURATION = 2000;
const activeClouds: SmokeCloud[] = [];

export function spawnSmokeCloud(x: number, y: number, radius: number, duration: number) {
    if (app === undefined) return;

    const now = performance.now();
    const size = radius * 2;
    const el = document.createElement('div');
    el.classList.add('smoke-cloud');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    app.appendChild(el);

    activeClouds.push({
        x,
        y,
        radius,
        expiresAt: now + duration,
        fadeStart: now + duration - FADE_DURATION,
        element: el,
        fading: false,
    });
}

export function updateSmokeClouds(timestamp: number) {
    for (let i = activeClouds.length - 1; i >= 0; i--) {
        const cloud = activeClouds[i];

        if (timestamp >= cloud.fadeStart && !cloud.fading) {
            cloud.fading = true;
            cloud.element.classList.add('fading');
        }

        if (timestamp >= cloud.expiresAt) {
            cloud.element.remove();
            activeClouds.splice(i, 1);
        }
    }
}
