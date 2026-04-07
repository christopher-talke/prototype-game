import { app } from '../Globals/App';

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

export function spawnSmoke(x: number, y: number, radius: number, duration: number) {
    const size = radius * 2;
    const el = document.createElement('div');
    el.classList.add('smoke-cloud');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    app.appendChild(el);

    const now = performance.now();
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

// Check if a line from (x1,y1) to (x2,y2) passes through any active smoke cloud
export function isSmoked(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const cloud of activeClouds) {
        if (lineIntersectsCircle(x1, y1, x2, y2, cloud.x, cloud.y, cloud.radius)) {
            return true;
        }
    }
    return false;
}

function lineIntersectsCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    if (a < 1e-10) {
        // Degenerate line (point)
        return fx * fx + fy * fy <= r * r;
    }

    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    // Check if intersection is within the segment [0, 1]
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}
