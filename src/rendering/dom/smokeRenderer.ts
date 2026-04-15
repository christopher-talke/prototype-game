/**
 * DOM smoke cloud renderer. Creates circular div elements that fade out
 * before expiration. Used only when the DOM renderer is active; the PixiJS
 * renderer has its own volumetric smoke system.
 */

import { app } from '../../app';

/** Internal tracking for a single active smoke cloud DOM element. */
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

/**
 * Creates a smoke cloud DOM element at the given world position.
 * @param x - World X center of the smoke cloud
 * @param y - World Y center of the smoke cloud
 * @param radius - Radius of the smoke cloud in pixels
 * @param duration - Total lifetime in milliseconds (includes fade)
 */
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

/**
 * Ticks all active smoke clouds, applying fade CSS class when nearing
 * expiration and removing expired clouds from the DOM.
 * Called once per frame.
 * @param timestamp - Current frame timestamp from performance.now()
 */
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
