import { Container, Graphics, Matrix, RenderTexture, Sprite, Texture, Ticker } from 'pixi.js';
import { getPixiApp } from './app';
import { lightingLayer } from './sceneGraph';
import { computeLightPolygon } from './lightRaycast';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import { getAllPlayers } from '@simulation/player/playerRegistry';
import { getAdapter } from '@net/activeAdapter';
import { environment } from '@simulation/environment/environment';

// --- Ambient light ---
const DEFAULT_AMBIENT_LEVEL = 0.3;
const DEFAULT_AMBIENT_COLOR = 0x141420;

let ambientLevel = DEFAULT_AMBIENT_LEVEL;
let ambientColor = DEFAULT_AMBIENT_COLOR;
let ambientFillColor = 0x000000;

// --- Light state ---
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

// --- Render targets ---
let lightMapRT: RenderTexture | null = null;
let lightMapSprite: Sprite | null = null;
let drawContainer: Container | null = null;
let ambientRect: Graphics | null = null;
let lightGraphics: Graphics | null = null; // single Graphics for all lights
let initialized = false;

// --- Gradient texture cache ---
const gradientCache = new Map<number, Texture>();
const RADIUS_BUCKET = 50;

function bucketRadius(r: number): number {
    return Math.ceil(r / RADIUS_BUCKET) * RADIUS_BUCKET;
}

function getGradientTexture(radius: number): Texture {
    const bucketed = bucketRadius(radius);
    let tex = gradientCache.get(bucketed);
    if (tex) return tex;

    const size = bucketed * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(bucketed, bucketed, 0, bucketed, bucketed, bucketed);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    tex = Texture.from(canvas);
    gradientCache.set(bucketed, tex);
    return tex;
}

// --- Color math ---
function lerpColorChannel(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
}

function computeAmbientFill(level: number, color: number): number {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return (lerpColorChannel(r, 255, level) << 16) |
           (lerpColorChannel(g, 255, level) << 8) |
           lerpColorChannel(b, 255, level);
}

// --- Drawing helpers ---

// Build a transform matrix that maps the gradient texture onto world coords
// so the gradient center aligns with the light position
const _matrix = new Matrix();

function drawLightPolygon(g: Graphics, light: LightEntry) {
    if (!light.polygon) return;
    const tex = getGradientTexture(light.radius);
    const bucketed = bucketRadius(light.radius);
    const scale = light.radius / bucketed;

    // Matrix maps texture coords -> world coords
    // Texture is (bucketed*2 x bucketed*2), center at (bucketed, bucketed)
    // We want the center at (light.x, light.y) with proper scale
    _matrix.identity();
    _matrix.scale(scale, scale);
    _matrix.translate(light.x - light.radius, light.y - light.radius);

    g.poly(light.polygon).fill({ texture: tex, matrix: _matrix, alpha: light.intensity, color: light.color });
}

function drawLightCircle(g: Graphics, x: number, y: number, radius: number, color: number, intensity: number) {
    const tex = getGradientTexture(radius);
    const bucketed = bucketRadius(radius);
    const scale = radius / bucketed;

    _matrix.identity();
    _matrix.scale(scale, scale);
    _matrix.translate(x - radius, y - radius);

    g.circle(x, y, radius).fill({ texture: tex, matrix: _matrix, alpha: intensity, color });
}

// --- Core rendering ---

function renderLightMap() {
    const app = getPixiApp();
    if (!app || !lightMapRT || !drawContainer || !ambientRect || !lightGraphics) return;

    // Redraw ambient fill (only if color changed, but cheap enough to always do)
    ambientRect.clear();
    ambientRect.rect(0, 0, environment.limits.right, environment.limits.bottom).fill(ambientFillColor);

    // Redraw all lights into single Graphics
    lightGraphics.clear();

    for (const light of staticLights) {
        if (light.polygon) {
            drawLightPolygon(lightGraphics, light);
        } else {
            drawLightCircle(lightGraphics, light.x, light.y, light.radius, light.color, light.intensity);
        }
    }

    for (const [, light] of playerLightMap) {
        if (light.polygon) {
            drawLightPolygon(lightGraphics, light);
        } else {
            drawLightCircle(lightGraphics, light.x, light.y, light.radius, light.color, light.intensity);
        }
    }

    for (const tl of transientLights) {
        const alpha = tl.decayMs > 0 ? tl.intensity * Math.max(0, 1 - tl.elapsed / tl.decayMs) : tl.intensity;
        drawLightCircle(lightGraphics, tl.x, tl.y, tl.radius, tl.color, alpha);
    }

    // Clear RT before rendering to prevent accumulation from additive blend
    app.renderer.render({ container: drawContainer, target: lightMapRT, clear: true });
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

// --- Bullet light tracking ---
const bulletLightIds = new Map<number, number>();

// --- Event handling ---

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
    const app = getPixiApp();
    if (!app) return;

    clearLighting();

    ambientLevel = config?.ambientLight ?? DEFAULT_AMBIENT_LEVEL;
    ambientColor = config?.ambientColor ?? DEFAULT_AMBIENT_COLOR;
    ambientFillColor = computeAmbientFill(ambientLevel, ambientColor);

    const w = environment.limits.right;
    const h = environment.limits.bottom;

    lightMapRT = RenderTexture.create({ width: w, height: h });
    lightMapSprite = new Sprite(lightMapRT);
    lightMapSprite.blendMode = 'multiply';
    lightMapSprite.label = 'lightMapSprite';
    lightingLayer.addChild(lightMapSprite);

    drawContainer = new Container();
    drawContainer.label = 'lightDrawContainer';
    ambientRect = new Graphics();
    lightGraphics = new Graphics();
    lightGraphics.blendMode = 'add';

    // Add children once -- they stay attached, just get .clear() + redrawn each frame
    drawContainer.addChild(ambientRect);
    drawContainer.addChild(lightGraphics);

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
    ambientFillColor = computeAmbientFill(ambientLevel, ambientColor);
}

// Expose for console testing: setAmbientLight(0.8) for daytime, setAmbientLight(0.05) for deep night
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

    if (lightMapSprite) {
        lightMapSprite.destroy();
        lightMapSprite = null;
    }
    if (lightMapRT) {
        lightMapRT.destroy(true);
        lightMapRT = null;
    }
    if (lightGraphics) {
        lightGraphics.destroy();
        lightGraphics = null;
    }
    if (ambientRect) {
        ambientRect.destroy();
        ambientRect = null;
    }
    if (drawContainer) {
        drawContainer.removeChildren();
        drawContainer.destroy();
        drawContainer = null;
    }
    initialized = false;
}
