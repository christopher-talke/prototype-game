import { type Graphics } from 'pixi.js';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import { getPixiCameraOffset } from './camera';
import { swapRemove } from './renderUtils';
import { gridConfig } from './config/gridConfig';

// --- Types ---

export type DisplacementSourceConfig = {
    x: number;
    y: number;
    radius: number;
    strength: number;
    duration: number;       // ms, 0 = single-frame impulse
    direction?: { dx: number; dy: number };
    maxDisplacement?: number; // override gridConfig.maxDisplacement for this source
};

interface ActiveSource {
    id: number;
    x: number;
    y: number;
    radius: number;
    strength: number;
    duration: number;
    elapsed: number;
    dirX: number;
    dirY: number;
    radial: boolean;
    maxDisplacement: number;
}

// --- Module state ---

let cols = 0;
let rows = 0;
let pointCount = 0;

let displaceX: Float32Array | null = null;
let displaceY: Float32Array | null = null;
let velocityX: Float32Array | null = null;
let velocityY: Float32Array | null = null;

const activeSources: ActiveSource[] = [];
let nextSourceId = 1;

let prevPlayerX = 0;
let prevPlayerY = 0;
let prevPlayerValid = false;

let gridGfx: Graphics | null = null;

let lastTimestamp = 0;

// --- Public API ---

export function addDisplacementSource(config: DisplacementSourceConfig): number {
    const id = nextSourceId++;
    const hasDir = config.direction != null;
    activeSources.push({
        id,
        x: config.x,
        y: config.y,
        radius: config.radius,
        strength: config.strength,
        duration: config.duration,
        elapsed: 0,
        dirX: hasDir ? config.direction!.dx : 0,
        dirY: hasDir ? config.direction!.dy : 0,
        radial: !hasDir,
        maxDisplacement: config.maxDisplacement ?? gridConfig.maxDisplacement,
    });
    return id;
}

export function removeDisplacementSource(id: number): void {
    const idx = activeSources.findIndex(s => s.id === id);
    if (idx >= 0) swapRemove(activeSources, idx);
}

export function initGridDisplacement(): void {
    gameEventBus.subscribe(handleEvent);
}

export function initGridPoints(width: number, height: number, gfx: Graphics): void {
    gridGfx = gfx;

    cols = Math.floor((width - 1) / gridConfig.spacing);
    rows = Math.floor((height - 1) / gridConfig.spacing);
    pointCount = cols * rows;

    displaceX = new Float32Array(pointCount);
    displaceY = new Float32Array(pointCount);
    velocityX = new Float32Array(pointCount);
    velocityY = new Float32Array(pointCount);

    activeSources.length = 0;
    prevPlayerValid = false;
    lastTimestamp = 0;
}

export function updateGridDisplacement(
    player: player_info,
    projectiles: readonly { id: number; x: number; y: number }[] = [],
): void {
    if (!displaceX || !gridGfx) return;

    const now = performance.now();
    let dt = lastTimestamp > 0 ? (now - lastTimestamp) / 1000 : 1 / 60;
    if (dt > gridConfig.maxDt) dt = gridConfig.maxDt;
    lastTimestamp = now;

    applyPlayerWake(player, dt);
    applyBulletTravel(dt, projectiles);
    tickSources(dt);
    stepPhysics(dt);
    renderGrid();
}

export function clearGridDisplacement(): void {
    displaceX?.fill(0);
    displaceY?.fill(0);
    velocityX?.fill(0);
    velocityY?.fill(0);
    activeSources.length = 0;
    prevPlayerValid = false;
    lastTimestamp = 0;
}

// --- Event handling ---

function handleEvent(event: GameEvent): void {
    // GRENADE_DETONATE displacement is now handled per-type by the effect modules
    // (fragEffect.ts, c4Effect.ts, etc.) for distinct grid signatures.
    if (event.type === 'GRENADE_DETONATE') {
        // Flash and smoke get generic displacement; frag/c4 handled by their effect modules
        if (event.grenadeType === 'FLASH') {
            addDisplacementSource({
                x: event.x, y: event.y,
                radius: event.radius,
                strength: event.radius * gridConfig.flashStrengthMultiplier,
                duration: gridConfig.flashDuration,
            });
        } else if (event.grenadeType === 'SMOKE') {
            addDisplacementSource({
                x: event.x, y: event.y,
                radius: event.radius,
                strength: event.radius * gridConfig.smokeStrengthMultiplier,
                duration: gridConfig.smokeDuration,
            });
        }
        // FRAG and C4 displacement is spawned by their respective effect modules
    } else if (event.type === 'BULLET_HIT') {
        addDisplacementSource({
            x: event.x,
            y: event.y,
            radius: gridConfig.bulletHitRadius,
            strength: gridConfig.bulletHitStrength,
            duration: 0,
            direction: { dx: event.bulletDx, dy: event.bulletDy },
        });
    } else if (event.type === 'ROUND_START') {
        clearGridDisplacement();
    }
}

// --- Player wake ---

function applyPlayerWake(player: player_info, dt: number): void {
    const px = player.current_position.x;
    const py = player.current_position.y;

    if (prevPlayerValid) {
        const vx = (px - prevPlayerX) / dt;
        const vy = (py - prevPlayerY) / dt;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > gridConfig.playerSpeedThreshold) {
            const nx = vx / speed;
            const ny = vy / speed;
            const speedFactor = Math.min(speed / gridConfig.playerSpeedDivisor, 1);
            applyDirectionalForce(px, py, gridConfig.playerWakeRadius, gridConfig.playerWakeStrength * speedFactor, nx, ny, dt);
        }
    }

    prevPlayerX = px;
    prevPlayerY = py;
    prevPlayerValid = true;
}

// --- Bullet travel ripple ---

function applyBulletTravel(dt: number, projectiles: readonly { id: number; x: number; y: number }[]): void {
    for (const p of projectiles) {
        applyRadialForce(p.x, p.y, gridConfig.bulletTravelRadius, gridConfig.bulletTravelStrength, dt);
    }
}

// --- Source ticking ---

function tickSources(dt: number): void {
    const dtMs = dt * 1000;

    for (let i = activeSources.length - 1; i >= 0; i--) {
        const s = activeSources[i];
        s.elapsed += dtMs;

        if (s.duration > 0 && s.elapsed >= s.duration) {
            swapRemove(activeSources, i);
            continue;
        }

        const timeFactor = s.duration > 0 ? 1 - s.elapsed / s.duration : 1;

        if (s.radial) {
            applyRadialForce(s.x, s.y, s.radius, s.strength * timeFactor, dt);
        } else {
            applyDirectionalForce(s.x, s.y, s.radius, s.strength * timeFactor, s.dirX, s.dirY, dt);
        }

        if (s.duration === 0) {
            swapRemove(activeSources, i);
        }
    }
}

// --- Force application ---

function applyRadialForce(sx: number, sy: number, radius: number, strength: number, dt: number): void {
    if (!displaceX || !velocityX || !displaceY || !velocityY) return;

    const colMin = Math.max(0, Math.floor((sx - radius) / gridConfig.spacing) - 1);
    const colMax = Math.min(cols - 1, Math.floor((sx + radius) / gridConfig.spacing));
    const rowMin = Math.max(0, Math.floor((sy - radius) / gridConfig.spacing) - 1);
    const rowMax = Math.min(rows - 1, Math.floor((sy + radius) / gridConfig.spacing));

    for (let r = rowMin; r <= rowMax; r++) {
        for (let c = colMin; c <= colMax; c++) {
            const restX = (c + 1) * gridConfig.spacing;
            const restY = (r + 1) * gridConfig.spacing;
            const dx = restX - sx;
            const dy = restY - sy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= radius || dist < 1) continue;

            const falloff = 1 - dist / radius;
            const force = strength * falloff * dt;
            const nx = dx / dist;
            const ny = dy / dist;

            const i = r * cols + c;
            velocityX[i] += nx * force;
            velocityY[i] += ny * force;
        }
    }
}

function applyDirectionalForce(sx: number, sy: number, radius: number, strength: number, dirX: number, dirY: number, dt: number): void {
    if (!displaceX || !velocityX || !displaceY || !velocityY) return;

    const colMin = Math.max(0, Math.floor((sx - radius) / gridConfig.spacing) - 1);
    const colMax = Math.min(cols - 1, Math.floor((sx + radius) / gridConfig.spacing));
    const rowMin = Math.max(0, Math.floor((sy - radius) / gridConfig.spacing) - 1);
    const rowMax = Math.min(rows - 1, Math.floor((sy + radius) / gridConfig.spacing));

    for (let r = rowMin; r <= rowMax; r++) {
        for (let c = colMin; c <= colMax; c++) {
            const restX = (c + 1) * gridConfig.spacing;
            const restY = (r + 1) * gridConfig.spacing;
            const dx = restX - sx;
            const dy = restY - sy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= radius) continue;

            const falloff = 1 - dist / radius;
            const force = strength * falloff * dt;

            const i = r * cols + c;
            velocityX[i] += dirX * force;
            velocityY[i] += dirY * force;
        }
    }
}

// --- Physics ---

function stepPhysics(dt: number): void {
    if (!displaceX || !displaceY || !velocityX || !velocityY) return;

    // Effective max is the highest among active sources (or default)
    let effectiveMax = gridConfig.maxDisplacement;
    for (const s of activeSources) {
        if (s.maxDisplacement > effectiveMax) effectiveMax = s.maxDisplacement;
    }

    for (let i = 0; i < pointCount; i++) {
        const ax = -gridConfig.springK * displaceX[i] - gridConfig.damping * velocityX[i];
        const ay = -gridConfig.springK * displaceY[i] - gridConfig.damping * velocityY[i];

        velocityX[i] += ax * dt;
        velocityY[i] += ay * dt;
        displaceX[i] += velocityX[i] * dt;
        displaceY[i] += velocityY[i] * dt;

        // Clamp displacement
        if (displaceX[i] > effectiveMax) displaceX[i] = effectiveMax;
        else if (displaceX[i] < -effectiveMax) displaceX[i] = -effectiveMax;
        if (displaceY[i] > effectiveMax) displaceY[i] = effectiveMax;
        else if (displaceY[i] < -effectiveMax) displaceY[i] = -effectiveMax;

        // Snap to rest
        if (Math.abs(displaceX[i]) < gridConfig.displacementEpsilon && Math.abs(velocityX[i]) < gridConfig.velocityEpsilon) {
            displaceX[i] = 0;
            velocityX[i] = 0;
        }
        if (Math.abs(displaceY[i]) < gridConfig.displacementEpsilon && Math.abs(velocityY[i]) < gridConfig.velocityEpsilon) {
            displaceY[i] = 0;
            velocityY[i] = 0;
        }
    }
}

// --- Rendering ---

function renderGrid(): void {
    if (!gridGfx || !displaceX || !displaceY) return;

    gridGfx.clear();

    const cam = getPixiCameraOffset();
    const vpW = window.visualViewport?.width ?? window.innerWidth;
    const vpH = window.visualViewport?.height ?? window.innerHeight;

    const margin = gridConfig.maxDisplacement + gridConfig.spacing;
    const colMin = Math.max(0, Math.floor((cam.x - margin) / gridConfig.spacing) - 1);
    const colMax = Math.min(cols - 1, Math.floor((cam.x + vpW + margin) / gridConfig.spacing));
    const rowMin = Math.max(0, Math.floor((cam.y - margin) / gridConfig.spacing) - 1);
    const rowMax = Math.min(rows - 1, Math.floor((cam.y + vpH + margin) / gridConfig.spacing));

    // Draw dots -- brighter and larger when displaced
    for (let r = rowMin; r <= rowMax; r++) {
        for (let c = colMin; c <= colMax; c++) {
            const i = r * cols + c;
            const dx = displaceX[i];
            const dy = displaceY[i];
            const px = (c + 1) * gridConfig.spacing + dx;
            const py = (r + 1) * gridConfig.spacing + dy;
            const t = Math.min(1, Math.sqrt(dx * dx + dy * dy) / gridConfig.maxDisplacement);
            const alpha = gridConfig.dotBaseAlpha + t * gridConfig.dotDisplaceAlpha;
            const radius = gridConfig.dotBaseRadius + t * gridConfig.dotDisplaceRadius;
            gridGfx.circle(px, py, radius).fill({ color: 0xffffff, alpha });
        }
    }

    // Build all line segments as a single batched path
    // Horizontal lines
    for (let r = rowMin; r <= rowMax; r++) {
        for (let c = colMin; c < Math.min(colMax, cols - 1); c++) {
            const i = r * cols + c;
            const i2 = i + 1;
            gridGfx.moveTo((c + 1) * gridConfig.spacing + displaceX[i], (r + 1) * gridConfig.spacing + displaceY[i]);
            gridGfx.lineTo((c + 2) * gridConfig.spacing + displaceX[i2], (r + 1) * gridConfig.spacing + displaceY[i2]);
        }
    }
    // Vertical lines
    for (let r = rowMin; r < Math.min(rowMax, rows - 1); r++) {
        for (let c = colMin; c <= colMax; c++) {
            const i = r * cols + c;
            const i2 = i + cols;
            gridGfx.moveTo((c + 1) * gridConfig.spacing + displaceX[i], (r + 1) * gridConfig.spacing + displaceY[i]);
            gridGfx.lineTo((c + 1) * gridConfig.spacing + displaceX[i2], (r + 2) * gridConfig.spacing + displaceY[i2]);
        }
    }
    // Single stroke for all lines
    gridGfx.stroke({ color: 0xffffff, alpha: gridConfig.lineAlpha, width: gridConfig.lineWidth });
}
