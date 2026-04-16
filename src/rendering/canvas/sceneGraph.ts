/**
 * Scene graph layer hierarchy for the PixiJS renderer.
 *
 * Layers are listed bottom-to-top (first added = rendered first = behind everything above it).
 * The lightingLayer is the critical divider:
 *   - Layers BELOW it are multiplied by the GPU lightmap (darkened outside FOV, lit by lights).
 *   - Layers ABOVE it are unaffected by lighting (always visible at full brightness).
 *
 * BELOW LIGHTING (affected by darkness/FOV):
 *   backgroundLayer      - grid dots, background fill
 *   wallLayer            - wall geometry
 *   scorchLayer          - ground scorch decals from explosions
 *   lastKnownLayer       - enemy last-known markers
 *   corpseLayer          - death markers
 *   grenadeLayer         - grenade projectile sprites
 *   debrisLayer          - non-emissive debris fragments
 *   projectileLayer      - bullet sprites
 *   playerLayer          - player circles
 *   healthBarLayer       - health/armor bars
 *   nametagLayer         - player name tags
 *   statusLabelLayer     - status text (RELOADING, etc)
 *   aimLineLayer         - aim direction lines
 *   fovConeLayer         - FOV cone visualization (debug/fallback)
 *
 * LIGHTING DIVIDER:
 *   lightingLayer        - GPU lightmap sprite with blendMode:'multiply'
 *
 * ABOVE LIGHTING (always visible regardless of FOV):
 *   diegeticHudLayer     - local player's in-world HUD (health arc, info boxes)
 *   sparkLayer           - emissive sparks, hot debris (additive blend)
 *   explosionFxLayer     - shockwave rings, wall sparks
 *   smokeParticleLayer   - volumetric smoke with per-particle CPU lighting
 *   flashLayer           - full-screen flash overlay
 *   postFxLayer          - chromatic aberration, desaturation, heat shimmer
 *   damageNumberLayer    - floating damage numbers
 *   fogOfWarLayer        - reserved slot (currently no-op)
 *
 * Part of the canvas rendering layer. Consumed by every canvas sub-system that needs
 * to place display objects at the correct depth.
 */

import { Container, Graphics } from 'pixi.js';

import { initGridPoints } from './gridDisplacement';
import { BACKGROUND_COLOR } from './renderConstants';

let backgroundRect: Graphics | null = null;
export let gridGraphics: Graphics | null = null;
export let gridTexturesBelowLayer: Container;
export let gridTexturesAboveLayer: Container;
export let glossLayer: Container;
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
export let lightingLayer: Container;
export let sparkLayer: Container;
export let explosionFxLayer: Container;
export let smokeParticleLayer: Container;
export let flashLayer: Container;
export let postFxLayer: Container;
export let damageNumberLayer: Container;
export let diegeticHudLayer: Container;
export let fogOfWarLayer: Container;

/**
 * Build the full scene graph hierarchy and attach it to the given PixiJS stage.
 * Must be called once during app initialization.
 * @param stage - The PixiJS Application stage container.
 */
export function createSceneGraph(stage: Container) {
    worldContainer = new Container();
    worldContainer.label = 'worldContainer';
    stage.addChild(worldContainer);

    backgroundLayer = addLayer('backgroundLayer');
    backgroundRect = new Graphics();
    backgroundLayer.addChild(backgroundRect);
    gridTexturesBelowLayer = new Container();
    gridTexturesBelowLayer.label = 'gridTexturesBelowLayer';
    backgroundLayer.addChild(gridTexturesBelowLayer);
    gridGraphics = new Graphics();
    backgroundLayer.addChild(gridGraphics);
    gridTexturesAboveLayer = new Container();
    gridTexturesAboveLayer.label = 'gridTexturesAboveLayer';
    backgroundLayer.addChild(gridTexturesAboveLayer);
    glossLayer = new Container();
    glossLayer.label = 'glossLayer';
    backgroundLayer.addChild(glossLayer);
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

    lightingLayer = addLayer('lightingLayer');

    diegeticHudLayer = addLayer('diegeticHudLayer');
    sparkLayer = addLayer('sparkLayer');
    explosionFxLayer = addLayer('explosionFxLayer');
    smokeParticleLayer = addLayer('smokeParticleLayer');
    flashLayer = addLayer('flashLayer');
    postFxLayer = addLayer('postFxLayer');
    damageNumberLayer = addLayer('damageNumberLayer');
    fogOfWarLayer = addLayer('fogOfWarLayer');
}

/**
 * Resize the background fill and reinitialize the grid displacement points for a new world size.
 * @param width - World width in pixels.
 * @param height - World height in pixels.
 */
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
