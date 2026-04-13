import { Graphics, Sprite, Texture, Ticker, ColorMatrixFilter } from 'pixi.js';
import { flashLayer, worldContainer } from '../sceneGraph';
import { getPixiCameraOffset } from '../camera';
import { effectsConfig } from '../config/effectsConfig';

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
    const gradientTexture = createRadialGradientTexture(effectsConfig.flash.gradientTextureSize);
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

    const fc = effectsConfig.flash;
    if (t < fc.whitePulseEnd) {
        const pt = t / fc.whitePulseEnd;
        overlay.alpha = intensity * pt;
        gradient.alpha = 0;
    }
    else if (t < fc.peakHoldEnd) {
        overlay.alpha = intensity;
        gradient.alpha = 0;
    }
    else if (t < fc.retinalBurnEnd) {
        const pt = (t - fc.peakHoldEnd) / (fc.retinalBurnEnd - fc.peakHoldEnd);
        overlay.alpha = intensity * Math.pow(1 - pt, 2);
        gradient.alpha = intensity * Math.pow(1 - pt, fc.retinalGradientDecayPower);
        gradient.scale.set(1 + pt * fc.retinalGradientExpansion);
    }
    else if (t < fc.desatPhaseEnd) {
        const pt = (t - fc.retinalBurnEnd) / (fc.desatPhaseEnd - fc.retinalBurnEnd);
        overlay.alpha = 0;
        gradient.alpha = intensity * fc.desatGradientAlpha * (1 - pt);

        if (desatFilter) {
            if (!worldContainer.filters || worldContainer.filters.indexOf(desatFilter) === -1) {
                worldContainer.filters = worldContainer.filters
                    ? [...worldContainer.filters, desatFilter]
                    : [desatFilter];
            }
            desatFilter.alpha = fc.desatPeakAlpha * intensity * (1 - pt);
        }
    }
    else {
        const pt = (t - fc.desatPhaseEnd) / (1 - fc.desatPhaseEnd);
        overlay.alpha = 0;
        gradient.alpha = intensity * fc.recoveryGradientAlpha * (1 - pt);

        if (desatFilter) {
            desatFilter.alpha = fc.recoveryDesatAlpha * intensity * (1 - pt);
        }
    }
});
