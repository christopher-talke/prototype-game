import { Sprite, Container, Ticker, RenderTexture, type Shader, type Mesh } from 'pixi.js';
import { lightingLayer } from './sceneGraph';
import { createLightingShader, createLightingMesh } from './shaders/lightingShader';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import { getAllPlayers, ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { getVisibleEnemies, getVisibleTeammates } from './playerRenderer';
import { getPixiApp } from './app';
import { environment } from '@simulation/environment/environment';
import { HALF_HIT_BOX, FOV, ROTATION_OFFSET } from '../../constants';
import { BULLET_COLOR, WALL_SPARK_COLOR } from './renderConstants';
import { swapRemove } from './renderUtils';

// --- Configuration---
export const lightingConfig = {
  // Base scene
  ambientLevel: 0.4,           
  ambientColor: 0x080814,      
  falloffExponent: 3.5,        
  coreSharpness: 0.06,         

  // Player
  playerRadius: 200,
  playerIntensity: 1.4,
  fovRadius: 1100,
  fovIntensity: 2.5,           
  fovSoftEdge: 8,              

  // Projectiles
  bulletRadius: 80,             
  bulletIntensity: 2.0,         
  bulletSniperRadius: 160,      
  bulletSniperIntensity: 2.5,
  bulletTrailAngle: 50,

  // Grenades
  grenadeRadius: 400,
  grenadeIntensity: 3.0,
  grenadeDecay: 400,
  flashRadius: 1000,
  flashIntensity: 4.0,          
  flashDecay: 800,

  // Impact effects
  deathBurstRadius: 280,
  deathBurstIntensity: 3.5,
  deathBurstDecay: 900,        
  wallHitRadius: 100,
  wallHitIntensity: 2.5,
  wallHitDecay: 300,

  // Last known
  lastKnownRadius: 160,
  lastKnownIntensity: 1.5,
};

const LIGHTMAP_SCALE = 0.5;

// --- Ambient state ---
let ambientLevel = lightingConfig.ambientLevel;
let ambientColor = lightingConfig.ambientColor;

// --- Light data ---
interface LightEntry {
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    cr: number; cg: number; cb: number; // cached color components (0-1)
}

interface TransientLight {
    id: number;
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    cr: number; cg: number; cb: number;
    decayMs: number;
    elapsed: number;
    castShadow: boolean;
    spotDirX: number;
    spotDirY: number;
    cosHalf: number;
    cosOuter: number;
}

function setRGB(entry: { cr: number; cg: number; cb: number }, hex: number) {
    entry.cr = ((hex >> 16) & 0xff) / 255;
    entry.cg = ((hex >> 8) & 0xff) / 255;
    entry.cb = (hex & 0xff) / 255;
}

const staticLights: LightEntry[] = [];
const playerLightMap = new Map<number, LightEntry>();
const transientLights: TransientLight[] = [];
const transientLightById = new Map<number, TransientLight>();
let transientIdCounter = 0;

// --- GPU lightmap state ---
let lightingShader: Shader | null = null;
let lightingMesh: Mesh | null = null;
let meshContainer: Container | null = null;
let lightmapRT: RenderTexture | null = null;
let lightmapSprite: Sprite | null = null;
let initialized = false;

// --- Color helpers ---
function hexToRGB(hex: number): [number, number, number] {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function lerpChannel(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function computeAmbientRGB(level: number, color: number): [number, number, number] {
    const [r, g, b] = hexToRGB(color);
    return [
        lerpChannel(r / 255, 1.0, level),
        lerpChannel(g / 255, 1.0, level),
        lerpChannel(b / 255, 1.0, level),
    ];
}

// --- Uniform upload ---

function uploadWallUniforms(walls: wall_info[]) {
    if (!lightingShader) return;
    const u = lightingShader.resources.lightingUniforms.uniforms;
    const arr = u.uWalls as Float32Array;
    const count = Math.min(walls.length, 128);
    for (let i = 0; i < count; i++) {
        const w = walls[i];
        const off = i * 4;
        arr[off] = w.x;
        arr[off + 1] = w.y;
        arr[off + 2] = w.width;
        arr[off + 3] = w.height;
    }
    u.uWallCount = count;
}

function uploadLightUniforms() {
    if (!lightingShader) return;
    const u = lightingShader.resources.lightingUniforms.uniforms;
    const posArr = u.uLightPosData as Float32Array;
    const colArr = u.uLightColorData as Float32Array;
    const spotArr = u.uLightSpotData as Float32Array;

    // Falloff curve params (live from debug panel)
    u.uFalloffExp = lightingConfig.falloffExponent;
    u.uCoreSharpness = lightingConfig.coreSharpness;

    let idx = 0;

    // Static lights (shadow-casting, point)
    for (const light of staticLights) {
        if (idx >= 32) break;
        writeLight(posArr, colArr, spotArr, idx, light, 1.0);
        idx++;
    }

    // Player ambient lights (shadow-casting)
    for (const [, light] of playerLightMap) {
        if (idx >= 32) break;
        writeLight(posArr, colArr, spotArr, idx, light, 1.0);
        idx++;
    }

    // FOV spotlight (shadow-casting)
    if (fovSpotlight && idx < 32) {
        writeLight(posArr, colArr, spotArr, idx, fovSpotlight.light, 1.0,
            fovSpotlight.dirX, fovSpotlight.dirY, fovSpotlight.cosHalf, fovSpotlight.cosOuter);
        idx++;
    }

    // Transient lights
    for (const tl of transientLights) {
        if (idx >= 32) break;
        const alpha = tl.decayMs > 0 ? Math.max(0, 1 - tl.elapsed / tl.decayMs) : 1;
        writeLight(posArr, colArr, spotArr, idx, tl, tl.castShadow ? 1.0 : 0.0,
            tl.spotDirX, tl.spotDirY, tl.cosHalf, tl.cosOuter, tl.intensity * alpha);
        idx++;
    }

    u.uLightCount = idx;

    // Ambient color (re-read from config each frame for live tuning)
    const [ar, ag, ab] = computeAmbientRGB(lightingConfig.ambientLevel, ambientColor);
    const ambArr = u.uAmbientColor as Float32Array;
    ambArr[0] = ar;
    ambArr[1] = ag;
    ambArr[2] = ab;
}

function writeLight(
    posArr: Float32Array, colArr: Float32Array, spotArr: Float32Array,
    idx: number, light: LightEntry, hasShadow: number,
    spotDirX = 0, spotDirY = 0, cosHalf = 0, cosOuter = 0,
    intensityOverride?: number,
) {
    const intensity = intensityOverride ?? light.intensity;
    const po = idx * 4;
    posArr[po] = light.x;
    posArr[po + 1] = light.y;
    posArr[po + 2] = light.radius;
    posArr[po + 3] = light.radius * intensity; // bloomRadius
    colArr[po] = light.cr * intensity;
    colArr[po + 1] = light.cg * intensity;
    colArr[po + 2] = light.cb * intensity;
    colArr[po + 3] = hasShadow;
    spotArr[po] = spotDirX;
    spotArr[po + 1] = spotDirY;
    spotArr[po + 2] = cosHalf;
    spotArr[po + 3] = cosOuter;
}

// --- Player lights ---
const PLAYER_LIGHT_COLOR = 0xffffff;
const _seenPlayers = new Set<number>();

function updatePlayerLights() {
    const players = getAllPlayers();
    const localPlayer = ACTIVE_PLAYER != null ? getPlayerInfo(ACTIVE_PLAYER) : null;
    const localTeam = localPlayer?.team;
    _seenPlayers.clear();

    for (const player of players) {
        if (player.dead) {
            playerLightMap.delete(player.id);
            continue;
        }

        // Only emit lights for local team + visible enemies
        if (localTeam != null && player.team !== localTeam && !getVisibleEnemies().has(player.id)) {
            playerLightMap.delete(player.id);
            continue;
        }

        _seenPlayers.add(player.id);
        const px = player.current_position.x + HALF_HIT_BOX;
        const py = player.current_position.y + HALF_HIT_BOX;

        // Teammates outside FOV get a small glow instead of full light
        const isLocalPlayer = player.id === ACTIVE_PLAYER;
        const isTeammateOutOfFOV = !isLocalPlayer
            && localTeam != null && player.team === localTeam
            && !getVisibleTeammates().has(player.id);

        const radius = isTeammateOutOfFOV ? lightingConfig.lastKnownRadius : lightingConfig.playerRadius;
        const intensity = isTeammateOutOfFOV ? lightingConfig.lastKnownIntensity : lightingConfig.playerIntensity;

        let light = playerLightMap.get(player.id);
        if (!light) {
            light = {
                x: px, y: py,
                radius,
                color: PLAYER_LIGHT_COLOR,
                intensity,
                cr: 1, cg: 1, cb: 1, // white
            };
            playerLightMap.set(player.id, light);
        } else {
            light.x = px;
            light.y = py;
            light.radius = radius;
            light.intensity = intensity;
        }
    }

    for (const [id] of playerLightMap) {
        if (!_seenPlayers.has(id)) playerLightMap.delete(id);
    }
}

// --- FOV spotlight ---
const DEG_TO_RAD = Math.PI / 180;
let fovSpotlight: { light: LightEntry; dirX: number; dirY: number; cosHalf: number; cosOuter: number } | null = null;

function updateFOVSpotlight() {
    if (ACTIVE_PLAYER == null) { fovSpotlight = null; return; }
    const p = getPlayerInfo(ACTIVE_PLAYER);
    if (!p || p.dead) { fovSpotlight = null; return; }

    const cx = p.current_position.x + HALF_HIT_BOX;
    const cy = p.current_position.y + HALF_HIT_BOX;
    const facingRad = (p.current_position.rotation - ROTATION_OFFSET) * DEG_TO_RAD;
    const dirX = Math.cos(facingRad);
    const dirY = Math.sin(facingRad);

    const halfFovRad = FOV * DEG_TO_RAD;
    const cosHalf = Math.cos(halfFovRad);
    const softEdgeDeg = lightingConfig.fovSoftEdge;
    const cosOuter = Math.cos((FOV + softEdgeDeg) * DEG_TO_RAD);

    fovSpotlight = {
        light: {
            x: cx, y: cy,
            radius: lightingConfig.fovRadius,
            color: 0xffffff,
            intensity: lightingConfig.fovIntensity,
            cr: 1, cg: 1, cb: 1,
        },
        dirX, dirY, cosHalf, cosOuter,
    };
}

// --- Transient lights ---

interface TransientSpot {
    dirX: number; dirY: number; cosHalf: number; cosOuter: number;
}

function addTransientLight(x: number, y: number, radius: number, color: number, intensity: number, decayMs: number = 0, castShadow: boolean = false, spot?: TransientSpot): number {
    const id = transientIdCounter++;
    const tl: TransientLight = {
        id, x, y, radius, color, intensity,
        cr: 0, cg: 0, cb: 0,
        decayMs, elapsed: 0, castShadow,
        spotDirX: spot?.dirX ?? 0, spotDirY: spot?.dirY ?? 0,
        cosHalf: spot?.cosHalf ?? 0, cosOuter: spot?.cosOuter ?? 0,
    };
    setRGB(tl, color);
    transientLights.push(tl);
    transientLightById.set(id, tl);
    return id;
}

function removeTransientLight(id: number) {
    const idx = transientLights.findIndex(t => t.id === id);
    if (idx !== -1) swapRemove(transientLights, idx);
    transientLightById.delete(id);
}

function updateTransientDecay(dt: number) {
    for (let i = transientLights.length - 1; i >= 0; i--) {
        const tl = transientLights[i];
        if (tl.decayMs <= 0) continue;
        tl.elapsed += dt;
        if (tl.elapsed >= tl.decayMs) {
            transientLightById.delete(tl.id);
            swapRemove(transientLights, i);
        }
    }
}

// --- Bullet tracking ---
interface BulletLightEntry { lightId: number; dx: number; dy: number }
const bulletLights = new Map<number, BulletLightEntry>();

function bulletTrailSpot(dx: number, dy: number): TransientSpot {
    // Cone points BACKWARD (opposite travel direction)
    const halfRad = lightingConfig.bulletTrailAngle * DEG_TO_RAD;
    const cosHalf = Math.cos(halfRad);
    const cosOuter = Math.cos((lightingConfig.bulletTrailAngle + 15) * DEG_TO_RAD);
    return { dirX: -dx, dirY: -dy, cosHalf, cosOuter };
}

function handleEvent(event: GameEvent) {
    if (!initialized) return;

    switch (event.type) {
        case 'BULLET_SPAWN': {
            const isSniper = event.weaponType === 'SNIPER';
            const spot = bulletTrailSpot(event.dx, event.dy);
            const lightId = addTransientLight(
                event.x, event.y,
                isSniper ? lightingConfig.bulletSniperRadius : lightingConfig.bulletRadius,
                isSniper ? 0xeeeeff : BULLET_COLOR,
                isSniper ? lightingConfig.bulletSniperIntensity : lightingConfig.bulletIntensity,
                0, true, spot,
            );
            bulletLights.set(event.bulletId, { lightId, dx: event.dx, dy: event.dy });
            break;
        }
        case 'BULLET_REMOVED': {
            const entry = bulletLights.get(event.bulletId);
            if (entry) {
                // Grab position before removing
                const tl = transientLights.find(t => t.id === entry.lightId);
                if (tl) {
                    // Wall-hit burst at impact point
                    addTransientLight(
                        tl.x, tl.y,
                        lightingConfig.wallHitRadius,
                        WALL_SPARK_COLOR, lightingConfig.wallHitIntensity,
                        lightingConfig.wallHitDecay, true,
                    );
                }
                removeTransientLight(entry.lightId);
                bulletLights.delete(event.bulletId);
            }
            break;
        }
        case 'BULLET_HIT': {
            if (event.isKill) {
                // Death burst
                addTransientLight(
                    event.x, event.y,
                    lightingConfig.deathBurstRadius,
                    0xff3300, lightingConfig.deathBurstIntensity,
                    lightingConfig.deathBurstDecay, true,
                );
            }
            break;
        }
        case 'PLAYER_KILLED': {
            const victim = getPlayerInfo(event.targetId);
            if (victim) {
                addTransientLight(
                    victim.current_position.x + HALF_HIT_BOX,
                    victim.current_position.y + HALF_HIT_BOX,
                    lightingConfig.deathBurstRadius,
                    0xff3300, lightingConfig.deathBurstIntensity,
                    lightingConfig.deathBurstDecay, true,
                );
            }
            break;
        }
        case 'GRENADE_DETONATE': {
            const isFlash = event.grenadeType === 'FLASH';
            addTransientLight(
                event.x, event.y,
                isFlash ? lightingConfig.flashRadius : lightingConfig.grenadeRadius,
                isFlash ? 0xffffff : 0xff8800,
                isFlash ? lightingConfig.flashIntensity : lightingConfig.grenadeIntensity,
                isFlash ? lightingConfig.flashDecay : lightingConfig.grenadeDecay,
                true,
            );
            break;
        }
        case 'ROUND_START': {
            clearDynamicLights();
            break;
        }
    }
}

function syncBulletLightPositions(projectiles: readonly { id: number; x: number; y: number }[]) {
    if (bulletLights.size === 0) return;
    for (const p of projectiles) {
        const entry = bulletLights.get(p.id);
        if (!entry) continue;
        const tl = transientLightById.get(entry.lightId);
        if (tl) {
            tl.x = p.x;
            tl.y = p.y;
        }
    }
}

// --- Last-known position lights ---
const lastKnownLightIds = new Map<string, number>();

export function addLastKnownLight(key: string, x: number, y: number) {
    removeLastKnownLight(key);
    const id = addTransientLight(
        x, y,
        lightingConfig.lastKnownRadius,
        0xff4444,
        lightingConfig.lastKnownIntensity,
        3500, // matches LAST_KNOWN_FADE_DURATION + fade
        false,
    );
    lastKnownLightIds.set(key, id);
}

export function removeLastKnownLight(key: string) {
    const id = lastKnownLightIds.get(key);
    if (id !== undefined) {
        removeTransientLight(id);
        lastKnownLightIds.delete(key);
    }
}

// --- Public API ---

export function initLightingSystem() {
    gameEventBus.subscribe(handleEvent);
}

export function initLighting(lights: LightDef[], walls: wall_info[], config?: LightingConfig) {
    clearLighting();

    ambientLevel = config?.ambientLight ?? lightingConfig.ambientLevel;
    ambientColor = config?.ambientColor ?? lightingConfig.ambientColor;

    const w = environment.limits.right;
    const h = environment.limits.bottom;
    const rtW = Math.ceil(w * LIGHTMAP_SCALE);
    const rtH = Math.ceil(h * LIGHTMAP_SCALE);

    // Create shader + mesh
    lightingShader = createLightingShader();
    lightingMesh = createLightingMesh(lightingShader);

    // Set world size uniform
    const u = lightingShader.resources.lightingUniforms.uniforms;
    const ws = u.uWorldSize as Float32Array;
    ws[0] = w;
    ws[1] = h;

    // Upload wall geometry (once per map)
    uploadWallUniforms(walls);

    // Build static light entries
    for (const def of lights) {
        const color = def.color ?? 0xffffff;
        const entry: LightEntry = {
            x: def.x,
            y: def.y,
            radius: def.radius,
            color,
            intensity: def.intensity ?? 1.0,
            cr: 0, cg: 0, cb: 0,
        };
        setRGB(entry, color);
        staticLights.push(entry);
    }

    // Wrap mesh in a container for renderer.render()
    meshContainer = new Container();
    meshContainer.addChild(lightingMesh);

    // Create RenderTexture at half world resolution
    lightmapRT = RenderTexture.create({ width: rtW, height: rtH });

    // Display sprite composites the lightmap onto the scene
    lightmapSprite = new Sprite(lightmapRT);
    lightmapSprite.width = w;
    lightmapSprite.height = h;
    lightmapSprite.blendMode = 'multiply';
    lightmapSprite.label = 'lightMapSprite';
    lightingLayer.addChild(lightmapSprite);

    initialized = true;
}

export function updateLighting(projectiles: readonly { id: number; x: number; y: number }[] = []) {
    if (!initialized) return;

    const dt = Ticker.shared.deltaMS;

    updatePlayerLights();
    updateFOVSpotlight();
    updateTransientDecay(dt);
    syncBulletLightPositions(projectiles);

    // Upload light data to shader uniforms
    uploadLightUniforms();

    // Render the lighting mesh to the RenderTexture
    const app = getPixiApp();
    if (app && meshContainer && lightmapRT) {
        app.renderer.render({
            container: meshContainer,
            target: lightmapRT,
            clear: true,
        });
    }
}

export function setAmbientLight(level: number) {
    ambientLevel = Math.max(0, Math.min(1, level));
}

(window as any).setAmbientLight = setAmbientLight;

export function getAmbientLight(): number {
    return ambientLevel;
}

function clearDynamicLights() {
    playerLightMap.clear();
    transientLights.length = 0;
    bulletLights.clear();
    lastKnownLightIds.clear();
}

export function clearLighting() {
    clearDynamicLights();
    staticLights.length = 0;

    if (lightmapSprite) {
        lightmapSprite.destroy();
        lightmapSprite = null;
    }
    if (lightmapRT) {
        lightmapRT.destroy(true);
        lightmapRT = null;
    }
    if (lightingMesh) {
        lightingMesh.destroy();
        lightingMesh = null;
    }
    if (meshContainer) {
        meshContainer.destroy();
        meshContainer = null;
    }
    lightingShader = null;
    initialized = false;
}
