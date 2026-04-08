import { app } from '../Globals/App';

// Pure simulation data - no DOM references
type SmokeData = {
    x: number;
    y: number;
    radius: number;
    expiresAt: number;
    fadeStart: number;
};

// Rendering state - extends data with DOM element
type SmokeCloud = SmokeData & {
    element: HTMLElement;
    fading: boolean;
};

const FADE_DURATION = 2000;
const smokeDatas: SmokeData[] = [];
const activeClouds: SmokeCloud[] = [];

export function spawnSmoke(x: number, y: number, radius: number, duration: number) {
    const now = performance.now();
    const data: SmokeData = {
        x,
        y,
        radius,
        expiresAt: now + duration,
        fadeStart: now + duration - FADE_DURATION,
    };
    smokeDatas.push(data);

    const size = radius * 2;
    const el = document.createElement('div');
    el.classList.add('smoke-cloud');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    app.appendChild(el);

    activeClouds.push({ ...data, element: el, fading: false });
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
    // Keep smokeDatas in sync with expired clouds
    for (let i = smokeDatas.length - 1; i >= 0; i--) {
        if (timestamp >= smokeDatas[i].expiresAt) {
            smokeDatas.splice(i, 1);
        }
    }
}

// Pure geometry query - reads only from simulation data, no DOM
export function isSmoked(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const data of smokeDatas) {
        if (lineIntersectsCircle(x1, y1, x2, y2, data.x, data.y, data.radius)) {
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
        return fx * fx + fy * fy <= r * r;
    }

    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}
