import { Sprite, Texture, Ticker } from 'pixi.js';
import { lightingLayer } from './sceneGraph';
import { computeLightPolygon } from './lightRaycast';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import { getAllPlayers } from '@simulation/player/playerRegistry';
import { getAdapter } from '@net/activeAdapter';
import { environment } from '@simulation/environment/environment';

// --- Constants ---
const DEFAULT_AMBIENT_LEVEL = 0.3;
const DEFAULT_AMBIENT_COLOR = 0x141420;
const LIGHTMAP_SCALE = 0.5; // half-res for performance

// --- Ambient state ---
let ambientLevel = DEFAULT_AMBIENT_LEVEL;
let ambientColor = DEFAULT_AMBIENT_COLOR;
let ambientR = 0, ambientG = 0, ambientB = 0; // computed fill channels

// --- Light data (no GPU objects, just data) ---
interface LightEntry {
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    polygon: number[] | null;
}

interface TransientLight {
    id: number;
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    decayMs: number;
    elapsed: number;
}

const staticLights: LightEntry[] = [];
const playerLightMap = new Map<number, LightEntry>();
const transientLights: TransientLight[] = [];
let transientIdCounter = 0;

// --- Canvas lightmap ---
let lightCanvas: HTMLCanvasElement | null = null;
let lightCtx: CanvasRenderingContext2D | null = null;
let lightSprite: Sprite | null = null;
let lightTexture: Texture | null = null;
let canvasW = 0;
let canvasH = 0;
let initialized = false;

// --- Color helpers ---
function hexToRGB(hex: number): [number, number, number] {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function lerpChannel(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
}

function computeAmbientRGB(level: number, color: number) {
    const [r, g, b] = hexToRGB(color);
    ambientR = lerpChannel(r, 255, level);
    ambientG = lerpChannel(g, 255, level);
    ambientB = lerpChannel(b, 255, level);
}

// --- Canvas 2D lightmap rendering ---

function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: number, intensity: number, polygon: number[] | null) {
    const [cr, cg, cb] = hexToRGB(color);
    const sr = Math.round(cr * intensity);
    const sg = Math.round(cg * intensity);
    const sb = Math.round(cb * intensity);

    // Scale coordinates to canvas space
    const sx = x * LIGHTMAP_SCALE;
    const sy = y * LIGHTMAP_SCALE;
    const sr2 = radius * LIGHTMAP_SCALE;

    ctx.save();

    // Clip to shadow polygon if available
    if (polygon) {
        ctx.beginPath();
        ctx.moveTo(polygon[0] * LIGHTMAP_SCALE, polygon[1] * LIGHTMAP_SCALE);
        for (let i = 2; i < polygon.length; i += 2) {
            ctx.lineTo(polygon[i] * LIGHTMAP_SCALE, polygon[i + 1] * LIGHTMAP_SCALE);
        }
        ctx.closePath();
        ctx.clip();
    }

    // Draw radial gradient
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr2);
    grad.addColorStop(0, `rgba(${sr},${sg},${sb},1)`);
    grad.addColorStop(0.4, `rgba(${sr},${sg},${sb},0.6)`);
    grad.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(sx - sr2, sy - sr2, sr2 * 2, sr2 * 2);

    ctx.restore();
}

function renderLightMap() {
    if (!lightCtx || !lightTexture) return;

    const ctx = lightCtx;

    // 1. Fill with ambient color (opaque)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgb(${ambientR},${ambientG},${ambientB})`;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. Switch to additive blend for lights
    ctx.globalCompositeOperation = 'lighter';

    // 3. Static lights
    for (const light of staticLights) {
        drawLight(ctx, light.x, light.y, light.radius, light.color, light.intensity, light.polygon);
    }

    // 4. Player lights
    for (const [, light] of playerLightMap) {
        drawLight(ctx, light.x, light.y, light.radius, light.color, light.intensity, light.polygon);
    }

    // 5. Transient lights (no shadow polygon)
    for (const tl of transientLights) {
        const alpha = tl.decayMs > 0 ? Math.max(0, 1 - tl.elapsed / tl.decayMs) : 1;
        drawLight(ctx, tl.x, tl.y, tl.radius, tl.color, tl.intensity * alpha, null);
    }

    // 6. Reset blend mode
    ctx.globalCompositeOperation = 'source-over';

    // 7. Push canvas update to GPU texture
    lightTexture.source.update();
}

// --- Player lights ---
const PLAYER_LIGHT_RADIUS = 150;
const PLAYER_LIGHT_COLOR = 0xffffff;
const PLAYER_LIGHT_INTENSITY = 0.4;

function updatePlayerLights() {
    const players = getAllPlayers();
    const seen = new Set<number>();

    for (const player of players) {
        if (player.dead) {
            playerLightMap.delete(player.id);
            continue;
        }

        seen.add(player.id);
        const px = player.current_position.x;
        const py = player.current_position.y;

        let light = playerLightMap.get(player.id);
        if (!light) {
            light = {
                x: px, y: py,
                radius: PLAYER_LIGHT_RADIUS,
                color: PLAYER_LIGHT_COLOR,
                intensity: PLAYER_LIGHT_INTENSITY,
                polygon: computeLightPolygon(px, py, PLAYER_LIGHT_RADIUS),
            };
            playerLightMap.set(player.id, light);
        } else {
            light.x = px;
            light.y = py;
            light.polygon = computeLightPolygon(px, py, PLAYER_LIGHT_RADIUS);
        }
    }

    for (const [id] of playerLightMap) {
        if (!seen.has(id)) playerLightMap.delete(id);
    }
}

// --- Transient lights ---

function addTransientLight(x: number, y: number, radius: number, color: number, intensity: number, decayMs: number = 0): number {
    const id = transientIdCounter++;
    transientLights.push({ id, x, y, radius, color, intensity, decayMs, elapsed: 0 });
    return id;
}

function removeTransientLight(id: number) {
    const idx = transientLights.findIndex(t => t.id === id);
    if (idx !== -1) transientLights.splice(idx, 1);
}

function updateTransientDecay(dt: number) {
    for (let i = transientLights.length - 1; i >= 0; i--) {
        const tl = transientLights[i];
        if (tl.decayMs <= 0) continue;
        tl.elapsed += dt;
        if (tl.elapsed >= tl.decayMs) {
            transientLights.splice(i, 1);
        }
    }
}

// --- Bullet tracking ---
const bulletLightIds = new Map<number, number>();

function handleEvent(event: GameEvent) {
    if (!initialized) return;

    switch (event.type) {
        case 'BULLET_SPAWN': {
            const lightId = addTransientLight(
                event.x, event.y, 60,
                event.weaponType === 'SNIPER' ? 0xffffff : 0xffcc00,
                0.3,
            );
            bulletLightIds.set(event.bulletId, lightId);
            break;
        }
        case 'BULLET_REMOVED': {
            const lightId = bulletLightIds.get(event.bulletId);
            if (lightId !== undefined) {
                removeTransientLight(lightId);
                bulletLightIds.delete(event.bulletId);
            }
            break;
        }
        case 'GRENADE_DETONATE': {
            addTransientLight(
                event.x, event.y, 300,
                event.grenadeType === 'FLASH' ? 0xffffff : 0xff9500,
                1.0,
                500,
            );
            break;
        }
        case 'ROUND_START': {
            clearDynamicLights();
            break;
        }
    }
}

function syncBulletLightPositions() {
    if (bulletLightIds.size === 0) return;
    const projectiles = getAdapter().getProjectiles();
    for (const p of projectiles) {
        const lightId = bulletLightIds.get(p.id);
        if (lightId === undefined) continue;
        const tl = transientLights.find(t => t.id === lightId);
        if (tl) {
            tl.x = p.x;
            tl.y = p.y;
        }
    }
}

// --- Public API ---

export function initLightingSystem() {
    gameEventBus.subscribe(handleEvent);
}

export function initLighting(lights: LightDef[], config?: LightingConfig) {
    clearLighting();

    ambientLevel = config?.ambientLight ?? DEFAULT_AMBIENT_LEVEL;
    ambientColor = config?.ambientColor ?? DEFAULT_AMBIENT_COLOR;
    computeAmbientRGB(ambientLevel, ambientColor);

    const w = environment.limits.right;
    const h = environment.limits.bottom;
    canvasW = Math.ceil(w * LIGHTMAP_SCALE);
    canvasH = Math.ceil(h * LIGHTMAP_SCALE);

    // Create Canvas 2D lightmap
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = canvasW;
    lightCanvas.height = canvasH;
    lightCtx = lightCanvas.getContext('2d')!;

    // Create PixiJS texture from canvas, displayed as multiply sprite
    lightTexture = Texture.from(lightCanvas);
    lightSprite = new Sprite(lightTexture);
    lightSprite.width = w;
    lightSprite.height = h;
    lightSprite.blendMode = 'multiply';
    lightSprite.label = 'lightMapSprite';
    lightingLayer.addChild(lightSprite);

    // Compute static light polygons once
    for (const def of lights) {
        staticLights.push({
            x: def.x,
            y: def.y,
            radius: def.radius,
            color: def.color ?? 0xffffff,
            intensity: def.intensity ?? 1.0,
            polygon: computeLightPolygon(def.x, def.y, def.radius),
        });
    }

    initialized = true;
}

export function updateLighting() {
    if (!initialized) return;

    const dt = Ticker.shared.deltaMS;

    updatePlayerLights();
    updateTransientDecay(dt);
    syncBulletLightPositions();
    renderLightMap();
}

export function setAmbientLight(level: number) {
    ambientLevel = Math.max(0, Math.min(1, level));
    computeAmbientRGB(ambientLevel, ambientColor);
}

(window as any).setAmbientLight = setAmbientLight;

export function getAmbientLight(): number {
    return ambientLevel;
}

function clearDynamicLights() {
    playerLightMap.clear();
    transientLights.length = 0;
    bulletLightIds.clear();
}

export function clearLighting() {
    clearDynamicLights();
    staticLights.length = 0;

    if (lightSprite) {
        lightSprite.destroy();
        lightSprite = null;
    }
    if (lightTexture) {
        lightTexture.destroy(true);
        lightTexture = null;
    }
    lightCanvas = null;
    lightCtx = null;
    initialized = false;
}
