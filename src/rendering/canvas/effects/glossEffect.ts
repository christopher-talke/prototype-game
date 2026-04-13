import { Sprite, Texture } from 'pixi.js';
import { glossLayer } from '../sceneGraph';

// --- State ---

let sprite: Sprite | null = null;
let texture: Texture | null = null;

// --- Public API ---

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

export function updateGloss(playerX: number, playerY: number): void {
    if (!sprite) return;
    sprite.x = playerX;
    sprite.y = playerY;
}

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

// --- Internal ---

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
