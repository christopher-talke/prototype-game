import { Sprite, Texture } from 'pixi.js';

import { glossLayer } from '../sceneGraph';

/**
 * Floor gloss/sheen effect module.
 *
 * Renders a radial gradient spotlight that follows the active player,
 * creating a subtle floor highlight. The gradient texture is generated
 * procedurally via Canvas 2D and composited with additive blending.
 *
 * Rendering layer, part of the effects sub-system under canvas rendering.
 * Configured via the FloorGloss type from map data.
 */

let sprite: Sprite | null = null;
let texture: Texture | null = null;

/**
 * Initializes the gloss effect from map configuration. Tears down any
 * existing gloss first. If no config is provided, only clears.
 *
 * @param config - Optional FloorGloss settings (radius, color, alpha,
 *   blendMode) from the map definition. When omitted, the effect is
 *   disabled.
 */
export function initGloss(config?: FloorGloss): void {
    clearGloss();
    if (!config) return;

    const radius = config.radius ?? 400;
    const color = config.color ?? 0xffffff;
    const alpha = config.alpha ?? 0.15;

    texture = createGlossTexture(radius, color);
    sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.alpha = alpha;
    sprite.blendMode = (config.blendMode as any) ?? 'add';
    glossLayer.addChild(sprite);
}

/**
 * Repositions the gloss sprite to track the player each frame.
 *
 * @param playerX - Player world X (center)
 * @param playerY - Player world Y (center)
 */
export function updateGloss(playerX: number, playerY: number): void {
    if (!sprite) return;
    sprite.x = playerX;
    sprite.y = playerY;
}

/** Removes the gloss sprite and destroys its texture. */
export function clearGloss(): void {
    if (sprite) {
        glossLayer.removeChild(sprite);
        sprite.destroy();
        sprite = null;
    }
    if (texture) {
        texture.destroy(true);
        texture = null;
    }
}

/**
 * Generates a radial gradient texture via Canvas 2D. The gradient has four
 * stops: full opacity at center, 50% at 0.25r, 10% at 0.6r, and
 * transparent at the edge.
 *
 * @param radius - Radius of the gradient in pixels
 * @param color - RGB hex color (e.g. 0xffffff)
 * @returns A Pixi Texture containing the radial gradient
 */
function createGlossTexture(radius: number, color: number): Texture {
    const size = radius * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.25, `rgba(${r},${g},${b},0.5)`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},0.1)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    return Texture.from(canvas);
}
