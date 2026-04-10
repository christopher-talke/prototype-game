import { Graphics } from 'pixi.js';
import { smokeLayer } from './pixiSceneGraph';

const FADE_DURATION = 2000;

type PixiSmoke = {
    g: Graphics;
    expiresAt: number;
    fadeStart: number;
};

const activeClouds: PixiSmoke[] = [];

export function spawnPixiSmokeCloud(x: number, y: number, radius: number, duration: number) {
    const now = performance.now();
    const g = new Graphics();
    g.circle(0, 0, radius).fill({ color: 0x888899, alpha: 0.65 });
    g.x = x;
    g.y = y;
    smokeLayer.addChild(g);
    activeClouds.push({ g, expiresAt: now + duration, fadeStart: now + duration - FADE_DURATION });
}

export function updatePixiSmokeClouds(timestamp: number) {
    for (let i = activeClouds.length - 1; i >= 0; i--) {
        const cloud = activeClouds[i];
        if (timestamp >= cloud.expiresAt) {
            cloud.g.destroy();
            activeClouds.splice(i, 1);
        } else if (timestamp >= cloud.fadeStart) {
            cloud.g.alpha = 1 - (timestamp - cloud.fadeStart) / FADE_DURATION;
        }
    }
}

export function clearPixiSmokeClouds() {
    for (const cloud of activeClouds) cloud.g.destroy();
    activeClouds.length = 0;
}
