import { Graphics, Sprite, Texture, Ticker, ColorMatrixFilter } from 'pixi.js';
import { flashLayer, worldContainer } from '../sceneGraph';
import { getPixiCameraOffset } from '../camera';

// --- State ---

interface FlashState {
    intensity: number;
    duration: number;
    elapsed: number;
    overlay: Graphics;
    gradient: Sprite;
    gradientTexture: Texture;
    desatFilter: ColorMatrixFilter | null;
}

let active: FlashState | null = null;

// --- Texture generation ---

function createRadialGradientTexture(size: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return Texture.from(canvas);
}

// --- Public API ---

export function triggerFlashEffect(intensity: number, duration: number) {
    // Clean up any existing flash
    clearFlashEffect();

    const vpW = window.visualViewport?.width ?? window.innerWidth;
    const vpH = window.visualViewport?.height ?? window.innerHeight;

    // Full-screen white overlay
    const overlay = new Graphics();
    overlay.rect(0, 0, vpW + 200, vpH + 200);
    overlay.fill({ color: 0xffffff, alpha: 1 });
    overlay.alpha = 0;
    flashLayer.addChild(overlay);

    // Radial gradient for retinal burn (brighter center, dimmer edges)
    const gradSize = Math.max(vpW, vpH) * 2;
    const gradientTexture = createRadialGradientTexture(256);
    const gradient = new Sprite(gradientTexture);
    gradient.anchor.set(0.5);
    gradient.width = gradSize;
    gradient.height = gradSize;
    gradient.alpha = 0;
    flashLayer.addChild(gradient);

    // Desaturation filter for grey phase
    const desatFilter = new ColorMatrixFilter();
    desatFilter.desaturate();
    desatFilter.alpha = 0;

    active = {
        intensity,
        duration,
        elapsed: 0,
        overlay,
        gradient,
        gradientTexture,
        desatFilter,
    };
}

export function clearFlashEffect() {
    if (!active) return;
    active.overlay.destroy();
    active.gradient.destroy();
    active.gradientTexture.destroy();
    // Remove desat filter from worldContainer
    if (active.desatFilter && worldContainer.filters) {
        const idx = worldContainer.filters.indexOf(active.desatFilter);
        if (idx >= 0) {
            const arr = [...worldContainer.filters];
            arr.splice(idx, 1);
            worldContainer.filters = arr.length > 0 ? arr : null;
        }
    }
    active = null;
}

// --- Ticker ---

Ticker.shared.add((ticker) => {
    if (!active) return;
    const dt = ticker.deltaMS;
    active.elapsed += dt;

    const { intensity, duration, elapsed, overlay, gradient, desatFilter } = active;
    const t = elapsed / duration;

    // Reposition to camera offset (screen-fixed in world-space layer)
    const cam = getPixiCameraOffset();
    const vpW = window.visualViewport?.width ?? window.innerWidth;
    const vpH = window.visualViewport?.height ?? window.innerHeight;
    overlay.x = cam.x - 100;
    overlay.y = cam.y - 100;
    gradient.x = cam.x + vpW / 2;
    gradient.y = cam.y + vpH / 2;

    if (t >= 1) {
        clearFlashEffect();
        return;
    }

    // Phase 1: White pulse (0 - 5%)
    if (t < 0.05) {
        const pt = t / 0.05;
        overlay.alpha = intensity * pt;
        gradient.alpha = 0;
    }
    // Phase 2: Peak hold (5% - 6%)
    else if (t < 0.06) {
        overlay.alpha = intensity;
        gradient.alpha = 0;
    }
    // Phase 3: Retinal burn (6% - 40%)
    // Flat overlay fades, radial gradient takes over (center stays bright longer)
    else if (t < 0.4) {
        const pt = (t - 0.06) / 0.34;
        // Flat overlay fades quickly
        overlay.alpha = intensity * Math.pow(1 - pt, 2);
        // Radial gradient: center bright, edges clear faster
        // Center alpha = intensity * (1-pt)^0.5 (slow decay)
        // This is approximated by the gradient sprite's overall alpha
        gradient.alpha = intensity * Math.pow(1 - pt, 0.5);
        gradient.scale.set(1 + pt * 0.5); // slight expansion
    }
    // Phase 4: Desaturation (40% - 70%)
    // Gradient continues fading, scene goes grey
    else if (t < 0.7) {
        const pt = (t - 0.4) / 0.3;
        overlay.alpha = 0;
        gradient.alpha = intensity * 0.3 * (1 - pt);

        // Apply desaturation to world
        if (desatFilter) {
            if (!worldContainer.filters || worldContainer.filters.indexOf(desatFilter) === -1) {
                worldContainer.filters = worldContainer.filters
                    ? [...worldContainer.filters, desatFilter]
                    : [desatFilter];
            }
            desatFilter.alpha = 0.6 * intensity * (1 - pt);
        }
    }
    // Phase 5: Recovery (70% - 100%)
    // Final center brightness fades, desaturation lifts
    else {
        const pt = (t - 0.7) / 0.3;
        overlay.alpha = 0;
        gradient.alpha = intensity * 0.1 * (1 - pt);

        if (desatFilter) {
            desatFilter.alpha = 0.15 * intensity * (1 - pt);
        }
    }
});
