/**
 * Spring-damped grid displacement system.
 *
 * Maintains a grid of points covering the world. Each point has a displacement
 * vector and velocity driven by spring-damper physics. External forces (player
 * movement wake, bullet travel ripple, explosions) push nearby points outward
 * or along a direction. Points spring back to rest when forces subside.
 *
 * An early-out optimization skips the physics loop and Graphics redraw entirely
 * when no active sources exist and all points have settled to rest.
 *
 * Part of the canvas rendering layer. The public {@link addDisplacementSource} /
 * {@link removeDisplacementSource} API is consumed by grenade effect modules
 * and the render pipeline.
 */

import { type Graphics } from 'pixi.js';

import { gameEventBus, type GameEvent } from '@net/gameEvent';
import { getPixiCameraOffset } from './camera';
import { swapRemove } from './renderUtils';
import { gridConfig } from './config/gridConfig';
import { GRENADE_VFX } from '@simulation/combat/grenades';
import { DEFAULT_WEAPON_VFX } from '@simulation/combat/weapons';

/**
 * Configuration for a displacement force source.
 * Consumed by {@link addDisplacementSource}.
 */
export type DisplacementSourceConfig = {
    /** World X of the source center. */
    x: number;
    /** World Y of the source center. */
    y: number;
    /** Radius of influence in world pixels. */
    radius: number;
    /** Force strength applied to grid points within radius. */
    strength: number;
    /** Lifetime in ms. 0 means a single-frame impulse. */
    duration: number;
    /** If set, force is applied along this direction instead of radially outward. */
    direction?: { dx: number; dy: number };
    /** Per-source clamp override for grid point displacement magnitude. */
    maxDisplacement?: number;
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
let gridSettled = true;

/**
 * Register a new displacement force source.
 * @param config - Position, radius, strength, duration, and optional direction.
 * @returns A unique source ID that can be passed to {@link removeDisplacementSource}.
 */
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

/**
 * Remove a displacement source before its duration expires.
 * @param id - Source ID returned by {@link addDisplacementSource}.
 */
export function removeDisplacementSource(id: number): void {
    const idx = activeSources.findIndex(s => s.id === id);
    if (idx >= 0) swapRemove(activeSources, idx);
}

/** Subscribe to the game event bus for grenade/bullet grid displacement events. */
export function initGridDisplacement(): void {
    gameEventBus.subscribe(handleEvent);
}

/**
 * Allocate SoA displacement/velocity arrays for the grid and bind the Graphics object.
 * Called by {@link setWorldBounds} in sceneGraph.ts whenever the world size changes.
 * @param width - World width in pixels.
 * @param height - World height in pixels.
 * @param gfx - The PixiJS Graphics used to draw the grid dots and lines.
 */
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

/**
 * Run one frame of the grid displacement system: apply forces, step physics, redraw.
 * Skips physics and rendering when the grid is settled (early-out optimization).
 * @param player - The local player, used for movement wake.
 * @param projectiles - Active bullet positions, used for travel ripple.
 */
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

    if (gridSettled) return;

    stepPhysics(dt);
    renderGrid();
}

/**
 * Return the current grid geometry for external consumers (e.g. grid texture mesh sync).
 * @returns Grid dimensions, spacing, and displacement arrays.
 */
export function getGridGeometry() {
    return { cols, rows, spacing: gridConfig.spacing, displaceX, displaceY };
}

/** Whether all grid points are at rest and no active sources exist. */
export function isGridSettled(): boolean {
    return gridSettled;
}

/** Zero all displacement/velocity data and remove all active sources. Forces one render pass. */
export function clearGridDisplacement(): void {
    displaceX?.fill(0);
    displaceY?.fill(0);
    velocityX?.fill(0);
    velocityY?.fill(0);
    activeSources.length = 0;
    prevPlayerValid = false;
    lastTimestamp = 0;
    gridSettled = false; // force one render pass to show cleared state
}

function handleEvent(event: GameEvent): void {
    if (event.type === 'GRENADE_DETONATE') {
        const gvfx = GRENADE_VFX[event.grenadeType];
        if ('gridDisplacement' in gvfx) {
            const gd = gvfx.gridDisplacement;
            addDisplacementSource({
                x: event.x, y: event.y,
                radius: event.radius,
                strength: event.radius * gd.strengthMultiplier,
                duration: gd.duration,
            });
        }
    }

    else if (event.type === 'BULLET_HIT') {
        addDisplacementSource({
            x: event.x,
            y: event.y,
            radius: DEFAULT_WEAPON_VFX.gridHit.radius,
            strength: DEFAULT_WEAPON_VFX.gridHit.strength,
            duration: 0,
            direction: { dx: event.bulletDx, dy: event.bulletDy },
        });
    }

    else if (event.type === 'ROUND_START') {
        clearGridDisplacement();
    }
}

/**
 * Apply a directional wake force around the local player based on movement velocity.
 * Only active when the player exceeds a speed threshold.
 */
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

/** Apply a small radial displacement around each active bullet. */
function applyBulletTravel(dt: number, projectiles: readonly { id: number; x: number; y: number }[]): void {
    for (const p of projectiles) {
        applyRadialForce(p.x, p.y, DEFAULT_WEAPON_VFX.gridTravel.radius, DEFAULT_WEAPON_VFX.gridTravel.strength, dt);
    }
}

/** Advance all active sources by dt, apply their forces, and remove expired ones. */
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
        }

        else {
            applyDirectionalForce(s.x, s.y, s.radius, s.strength * timeFactor, s.dirX, s.dirY, dt);
        }

        if (s.duration === 0) {
            swapRemove(activeSources, i);
        }
    }
}

/**
 * Push grid points radially outward from (sx, sy) with linear distance falloff.
 * Only points within the AABB of (sx +/- radius, sy +/- radius) are visited.
 */
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
            gridSettled = false;
        }
    }
}

/**
 * Push grid points along a fixed direction (dirX, dirY) with linear distance falloff.
 * Used for bullet wake and directional explosion forces.
 */
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
            gridSettled = false;
        }
    }
}

/**
 * Step spring-damper physics for every grid point.
 *
 * Each point is modeled as: `a = -springK * displacement - damping * velocity`.
 * Points are clamped to `effectiveMax` (the highest maxDisplacement among active
 * sources, or the default). Points within epsilon of rest are snapped to zero.
 * Sets `gridSettled = true` if no point has non-zero displacement or velocity.
 */
function stepPhysics(dt: number): void {
    if (!displaceX || !displaceY || !velocityX || !velocityY) return;

    let effectiveMax = gridConfig.maxDisplacement;
    for (const s of activeSources) {
        if (s.maxDisplacement > effectiveMax) effectiveMax = s.maxDisplacement;
    }

    let anyActive = false;
    for (let i = 0; i < pointCount; i++) {
        const ax = -gridConfig.springK * displaceX[i] - gridConfig.damping * velocityX[i];
        const ay = -gridConfig.springK * displaceY[i] - gridConfig.damping * velocityY[i];

        velocityX[i] += ax * dt;
        velocityY[i] += ay * dt;
        displaceX[i] += velocityX[i] * dt;
        displaceY[i] += velocityY[i] * dt;

        if (displaceX[i] > effectiveMax) displaceX[i] = effectiveMax;
        else if (displaceX[i] < -effectiveMax) displaceX[i] = -effectiveMax;
        if (displaceY[i] > effectiveMax) displaceY[i] = effectiveMax;
        else if (displaceY[i] < -effectiveMax) displaceY[i] = -effectiveMax;

        if (Math.abs(displaceX[i]) < gridConfig.displacementEpsilon && Math.abs(velocityX[i]) < gridConfig.velocityEpsilon) {
            displaceX[i] = 0;
            velocityX[i] = 0;
        }
        if (Math.abs(displaceY[i]) < gridConfig.displacementEpsilon && Math.abs(velocityY[i]) < gridConfig.velocityEpsilon) {
            displaceY[i] = 0;
            velocityY[i] = 0;
        }

        if (displaceX[i] !== 0 || velocityX[i] !== 0 || displaceY[i] !== 0 || velocityY[i] !== 0) {
            anyActive = true;
        }
    }
    gridSettled = !anyActive;
}

/**
 * Redraw the grid dots and connecting lines into the shared Graphics object.
 * Only points within the current viewport (plus a margin) are drawn.
 * Dot brightness and radius scale with displacement magnitude.
 */
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

    gridGfx.stroke({ color: 0xffffff, alpha: gridConfig.lineAlpha, width: gridConfig.lineWidth });
}
