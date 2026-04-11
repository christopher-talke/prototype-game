import { Container, Graphics, RenderTexture, Sprite, Texture, Ticker } from 'pixi.js';
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
let ambientFillColor = 0x000000; // computed from level + color

// --- Light state ---
interface StaticLight {
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    polygon: number[] | null;
    gradientSprite: Sprite;
    maskGraphics: Graphics | null;
}

interface TransientLight {
    id: number;
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    sprite: Sprite;
    decayMs: number;    // 0 = no decay
    elapsed: number;
}

const staticLights: StaticLight[] = [];
const playerLightMap = new Map<number, StaticLight>();
const transientLights: TransientLight[] = [];
let transientIdCounter = 0;

// --- Render targets ---
let lightMapRT: RenderTexture | null = null;
let lightMapSprite: Sprite | null = null;
let drawContainer: Container | null = null;
let ambientRect: Graphics | null = null;
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

// --- Core rendering ---

function createLightSprite(x: number, y: number, radius: number, color: number, intensity: number): Sprite {
    const tex = getGradientTexture(radius);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.width = radius * 2;
    sprite.height = radius * 2;
    sprite.x = x;
    sprite.y = y;
    sprite.tint = color;
    sprite.alpha = intensity;
    sprite.blendMode = 'add';
    return sprite;
}

function createMask(polygon: number[]): Graphics {
    const g = new Graphics();
    g.poly(polygon).fill({ color: 0xffffff });
    return g;
}

function renderLightMap() {
    const app = getPixiApp();
    if (!app || !lightMapRT || !drawContainer || !ambientRect) return;

    // Clear draw container
    drawContainer.removeChildren();

    // Ambient base fill
    const w = environment.limits.right;
    const h = environment.limits.bottom;
    ambientRect.clear();
    ambientRect.rect(0, 0, w, h).fill(ambientFillColor);
    drawContainer.addChild(ambientRect);

    // Static lights
    for (const light of staticLights) {
        if (light.maskGraphics) {
            light.gradientSprite.mask = light.maskGraphics;
            drawContainer.addChild(light.maskGraphics);
        }
        drawContainer.addChild(light.gradientSprite);
    }

    // Player lights
    for (const [, light] of playerLightMap) {
        if (light.maskGraphics) {
            light.gradientSprite.mask = light.maskGraphics;
            drawContainer.addChild(light.maskGraphics);
        }
        drawContainer.addChild(light.gradientSprite);
    }

    // Transient lights (no masks)
    for (const tl of transientLights) {
        drawContainer.addChild(tl.sprite);
    }

    app.renderer.render({ container: drawContainer, target: lightMapRT });
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
            if (playerLightMap.has(player.id)) removePlayerLight(player.id);
            continue;
        }

        seen.add(player.id);
        let light = playerLightMap.get(player.id);

        const px = player.current_position.x;
        const py = player.current_position.y;

        if (!light) {
            const polygon = computeLightPolygon(px, py, PLAYER_LIGHT_RADIUS);
            const sprite = createLightSprite(px, py, PLAYER_LIGHT_RADIUS, PLAYER_LIGHT_COLOR, PLAYER_LIGHT_INTENSITY);
            const mask = polygon ? createMask(polygon) : null;

            light = {
                x: px, y: py,
                radius: PLAYER_LIGHT_RADIUS,
                color: PLAYER_LIGHT_COLOR,
                intensity: PLAYER_LIGHT_INTENSITY,
                polygon,
                gradientSprite: sprite,
                maskGraphics: mask,
            };
            playerLightMap.set(player.id, light);
        } else {
            light.x = px;
            light.y = py;
            light.gradientSprite.x = px;
            light.gradientSprite.y = py;

            // Recompute polygon each frame for moving players
            const polygon = computeLightPolygon(px, py, PLAYER_LIGHT_RADIUS);
            light.polygon = polygon;
            if (light.maskGraphics) light.maskGraphics.destroy();
            light.maskGraphics = polygon ? createMask(polygon) : null;
        }
    }

    // Remove lights for players that no longer exist
    for (const [id] of playerLightMap) {
        if (!seen.has(id)) removePlayerLight(id);
    }
}

function removePlayerLight(id: number) {
    const light = playerLightMap.get(id);
    if (!light) return;
    light.gradientSprite.destroy();
    if (light.maskGraphics) light.maskGraphics.destroy();
    playerLightMap.delete(id);
}

// --- Transient lights ---

function addTransientLight(x: number, y: number, radius: number, color: number, intensity: number, decayMs: number = 0): number {
    const id = transientIdCounter++;
    const sprite = createLightSprite(x, y, radius, color, intensity);
    transientLights.push({ id, x, y, radius, color, intensity, sprite, decayMs, elapsed: 0 });
    return id;
}

function removeTransientLight(id: number) {
    const idx = transientLights.findIndex(t => t.id === id);
    if (idx === -1) return;
    transientLights[idx].sprite.destroy();
    transientLights.splice(idx, 1);
}

function updateTransientDecay(dt: number) {
    for (let i = transientLights.length - 1; i >= 0; i--) {
        const tl = transientLights[i];
        if (tl.decayMs <= 0) continue;
        tl.elapsed += dt;
        if (tl.elapsed >= tl.decayMs) {
            tl.sprite.destroy();
            transientLights.splice(i, 1);
        } else {
            const t = 1 - tl.elapsed / tl.decayMs;
            tl.sprite.alpha = tl.intensity * t;
        }
    }
}

// --- Bullet light tracking ---
const bulletLightIds = new Map<number, number>(); // bulletId -> transientLightId

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
            tl.sprite.x = p.x;
            tl.sprite.y = p.y;
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

    // Create static lights
    for (const def of lights) {
        const color = def.color ?? 0xffffff;
        const intensity = def.intensity ?? 1.0;
        const polygon = computeLightPolygon(def.x, def.y, def.radius);
        const sprite = createLightSprite(def.x, def.y, def.radius, color, intensity);
        const mask = polygon ? createMask(polygon) : null;

        staticLights.push({
            x: def.x,
            y: def.y,
            radius: def.radius,
            color,
            intensity,
            polygon,
            gradientSprite: sprite,
            maskGraphics: mask,
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
    for (const [, light] of playerLightMap) {
        light.gradientSprite.destroy();
        if (light.maskGraphics) light.maskGraphics.destroy();
    }
    playerLightMap.clear();

    for (const tl of transientLights) tl.sprite.destroy();
    transientLights.length = 0;
    bulletLightIds.clear();
}

export function clearLighting() {
    clearDynamicLights();

    for (const light of staticLights) {
        light.gradientSprite.destroy();
        if (light.maskGraphics) light.maskGraphics.destroy();
    }
    staticLights.length = 0;

    if (lightMapSprite) {
        lightMapSprite.destroy();
        lightMapSprite = null;
    }
    if (lightMapRT) {
        lightMapRT.destroy(true);
        lightMapRT = null;
    }
    if (drawContainer) {
        drawContainer.removeChildren();
        drawContainer.destroy();
        drawContainer = null;
    }
    if (ambientRect) {
        ambientRect.destroy();
        ambientRect = null;
    }
    initialized = false;
}
