/**
 * Scene Graph Layer Order
 * =======================
 * Layers are listed bottom-to-top (first added = rendered first = behind everything above it).
 * The lightingLayer is the critical divider:
 *   - Layers BELOW it are multiplied by the GPU lightmap (darkened outside FOV, lit by lights)
 *   - Layers ABOVE it are unaffected by lighting (always visible at full brightness)
 *
 * BELOW LIGHTING (affected by darkness/FOV):
 *   backgroundLayer      -- grid dots, background fill. Darkens naturally outside FOV.
 *   wallLayer            -- wall geometry. Physical world objects belong in darkness.
 *   scorchLayer          -- ground scorch decals from explosions. Terrain marks = lit by world.
 *   lastKnownLayer       -- enemy last-known markers. Intel markers in world space.
 *   corpseLayer          -- death markers. Physical remains on the ground.
 *   grenadeLayer         -- grenade projectile sprites. Physical thrown objects.
 *   debrisLayer          -- non-emissive debris fragments. Dark chunks of rubble.
 *   projectileLayer      -- bullet sprites. Small, but lit by their own transient light.
 *   playerLayer          -- player circles. Hidden/shown by applyPixiVisibility, not lighting.
 *   healthBarLayer       -- health/armor bars. Tied to player visibility.
 *   nametagLayer         -- player name tags. Tied to player visibility.
 *   statusLabelLayer     -- status text (RELOADING, etc). Tied to player visibility.
 *   aimLineLayer         -- aim direction lines. Local player UI, but rendered in world space.
 *   fovConeLayer         -- FOV cone visualization (debug/fallback).
 *
 * === lightingLayer ===  -- GPU lightmap sprite with blendMode:'multiply'. DIVIDING LINE.
 *
 * ABOVE LIGHTING (always visible regardless of FOV):
 *   sparkLayer           -- emissive sparks, hot debris (additive blend). Self-luminous particles.
 *   explosionFxLayer     -- shockwave rings, wall sparks. Sensory events perceived through walls.
 *   smokeParticleLayer   -- volumetric smoke. Visible in periphery; per-particle lighting via CPU.
 *   flashLayer           -- full-screen flash overlay. Screen-space blinding effect.
 *   postFxLayer          -- chromatic aberration, desaturation, heat shimmer. Camera effects.
 *   damageNumberLayer    -- floating damage numbers. HUD-like, always readable.
 *   fogOfWarLayer        -- fog of war overlay (currently no-op, slot preserved).
 */

import { Container, Graphics } from 'pixi.js';
import { initGridPoints } from './gridDisplacement';
import { BACKGROUND_COLOR } from './renderConstants';

let backgroundRect: Graphics | null = null;
export let gridGraphics: Graphics | null = null;
export let worldContainer: Container;
export let backgroundLayer: Container;
export let wallLayer: Container;
export let scorchLayer: Container;
export let lastKnownLayer: Container;
export let corpseLayer: Container;
export let grenadeLayer: Container;
export let debrisLayer: Container;
export let projectileLayer: Container;
export let playerLayer: Container;
export let healthBarLayer: Container;
export let nametagLayer: Container;
export let statusLabelLayer: Container;
export let aimLineLayer: Container;
export let fovConeLayer: Container;

// --- LIGHTING DIVIDER ---
export let lightingLayer: Container;

// --- ABOVE LIGHTING (always visible) ---
export let sparkLayer: Container;
export let explosionFxLayer: Container;
export let smokeParticleLayer: Container;
export let flashLayer: Container;
export let postFxLayer: Container;
export let damageNumberLayer: Container;
export let fogOfWarLayer: Container;

export function createSceneGraph(stage: Container) {
    worldContainer = new Container();
    worldContainer.label = 'worldContainer';
    stage.addChild(worldContainer);

    // --- BELOW LIGHTING ---
    backgroundLayer = addLayer('backgroundLayer');
    backgroundRect = new Graphics();
    backgroundLayer.addChild(backgroundRect);
    gridGraphics = new Graphics();
    backgroundLayer.addChild(gridGraphics);
    wallLayer = addLayer('wallLayer');
    scorchLayer = addLayer('scorchLayer');
    lastKnownLayer = addLayer('lastKnownLayer');
    corpseLayer = addLayer('corpseLayer');
    grenadeLayer = addLayer('grenadeLayer');
    debrisLayer = addLayer('debrisLayer');
    projectileLayer = addLayer('projectileLayer');
    playerLayer = addLayer('playerLayer');
    healthBarLayer = addLayer('healthBarLayer');
    nametagLayer = addLayer('nametagLayer');
    statusLabelLayer = addLayer('statusLabelLayer');
    aimLineLayer = addLayer('aimLineLayer');
    fovConeLayer = addLayer('fovConeLayer');

    // --- LIGHTING DIVIDER ---
    lightingLayer = addLayer('lightingLayer');

    // --- ABOVE LIGHTING ---
    sparkLayer = addLayer('sparkLayer');
    explosionFxLayer = addLayer('explosionFxLayer');
    smokeParticleLayer = addLayer('smokeParticleLayer');
    flashLayer = addLayer('flashLayer');
    postFxLayer = addLayer('postFxLayer');
    damageNumberLayer = addLayer('damageNumberLayer');
    fogOfWarLayer = addLayer('fogOfWarLayer');
}

export function setWorldBounds(width: number, height: number) {
    if (!backgroundRect) return;
    backgroundRect.clear();
    backgroundRect.rect(0, 0, width, height).fill(BACKGROUND_COLOR);

    if (gridGraphics) {
        initGridPoints(width, height, gridGraphics);
    }
}

function addLayer(label: string): Container {
    const c = new Container();
    c.label = label;
    worldContainer.addChild(c);
    return c;
}
