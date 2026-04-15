import { Graphics, Sprite, Texture, Ticker, ColorMatrixFilter } from 'pixi.js';

import { flashLayer, worldContainer } from '../sceneGraph';
import { getPixiCameraOffset } from '../camera';
import { effectsConfig } from '../config/effectsConfig';
import { GRENADE_VFX } from '@simulation/combat/grenades';

/**
 * Flashbang screen-effect module.
 *
 * Full PixiJS replacement for the legacy DOM flash overlay. Implements a
 * 5-phase visual timeline: white pulse ramp-up, peak hold, retinal burn
 * with expanding radial gradient, desaturation via ColorMatrixFilter, and
 * final recovery fade. All overlays are positioned in world space but
 * track the camera so they appear screen-fixed.
 *
 * Rendering layer, part of the effects sub-system under canvas rendering.
 * Consumes FlashVfx config from simulation/combat/grenades.ts.
 */

const vfx = GRENADE_VFX.FLASH.screenEffect;

/** Tracks the full state of one active flash effect across its 5 phases. */
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

/**
 * Generates a Canvas 2D radial gradient texture used for the retinal burn
 * phase. The gradient is white at center and fades to transparent at edges,
 * with color stops defined by vfx.gradientColorStops.
 *
 * @param size - Pixel dimensions of the square texture
 * @returns A Pixi Texture containing the radial gradient
 */
function createRadialGradientTexture(size: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    for (const stop of vfx.gradientColorStops) {
        grad.addColorStop(stop.offset, `rgba(255,255,255,${stop.alpha})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return Texture.from(canvas);
}

/**
 * Triggers a new flash effect, replacing any currently active one.
 *
 * Creates a full-screen white overlay and a radial gradient sprite for the
 * retinal burn phase, both parented to flashLayer. Also prepares a
 * ColorMatrixFilter for the desaturation phase but does not attach it
 * until that phase begins.
 *
 * @param intensity - Flash strength (0-1), scales all alpha values
 * @param duration - Total effect duration in milliseconds
 */
export function triggerFlashEffect(intensity: number, duration: number) {
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

/**
 * Immediately tears down the active flash effect: destroys overlay and
 * gradient sprites/textures, removes the desaturation filter from
 * worldContainer. Safe to call when no effect is active.
 */
export function clearFlashEffect() {
    if (!active) return;
    active.overlay.destroy();
    active.gradient.destroy();
    active.gradientTexture.destroy();
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

/**
 * Per-frame ticker callback. Drives the 5-phase flash timeline:
 *
 * 1. White pulse (0 to whitePulseEnd): overlay alpha ramps up linearly
 * 2. Peak hold (whitePulseEnd to peakHoldEnd): overlay at full intensity
 * 3. Retinal burn (peakHoldEnd to retinalBurnEnd): overlay fades via
 *    ease-out quadratic, gradient appears and expands
 * 4. Desaturation (retinalBurnEnd to desatPhaseEnd): gradient fades,
 *    ColorMatrixFilter attached to worldContainer
 * 5. Recovery (desatPhaseEnd to 1.0): all remaining effects fade to zero
 *
 * Overlay and gradient are repositioned each frame to track camera offset.
 */
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

    if (t < vfx.whitePulseEnd) {
        const pt = t / vfx.whitePulseEnd;
        overlay.alpha = intensity * pt;
        gradient.alpha = 0;
    }

    else if (t < vfx.peakHoldEnd) {
        overlay.alpha = intensity;
        gradient.alpha = 0;
    }

    else if (t < vfx.retinalBurnEnd) {
        const pt = (t - vfx.peakHoldEnd) / (vfx.retinalBurnEnd - vfx.peakHoldEnd);
        overlay.alpha = intensity * Math.pow(1 - pt, 2);
        gradient.alpha = intensity * Math.pow(1 - pt, vfx.retinalGradientDecayPower);
        gradient.scale.set(1 + pt * vfx.retinalGradientExpansion);
    }

    else if (t < vfx.desatPhaseEnd) {
        const pt = (t - vfx.retinalBurnEnd) / (vfx.desatPhaseEnd - vfx.retinalBurnEnd);
        overlay.alpha = 0;
        gradient.alpha = intensity * vfx.desatGradientAlpha * (1 - pt);

        if (desatFilter) {
            if (!worldContainer.filters || worldContainer.filters.indexOf(desatFilter) === -1) {
                worldContainer.filters = worldContainer.filters
                    ? [...worldContainer.filters, desatFilter]
                    : [desatFilter];
            }
            desatFilter.alpha = vfx.desatPeakAlpha * intensity * (1 - pt);
        }
    }

    else {
        const pt = (t - vfx.desatPhaseEnd) / (1 - vfx.desatPhaseEnd);
        overlay.alpha = 0;
        gradient.alpha = intensity * vfx.recoveryGradientAlpha * (1 - pt);

        if (desatFilter) {
            desatFilter.alpha = vfx.recoveryDesatAlpha * intensity * (1 - pt);
        }
    }
});
