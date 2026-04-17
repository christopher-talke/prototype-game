/**
 * Camera system for the PixiJS renderer.
 *
 * Tracks a target position (the local player), applies a weapon-look offset,
 * smoothly lerps the view, and layers on screen-shake. Every frame the
 * worldContainer is repositioned so the camera target stays centered.
 *
 * Part of the canvas rendering layer. Consumed by the render pipeline,
 * grid displacement, lighting manager, and player glow culling.
 */

import { worldContainer } from './sceneGraph';
import { cameraConfig } from './config/cameraConfig';

let currentOffsetX = 0;
let currentOffsetY = 0;

let targetX = 0;
let targetY = 0;
let offsetDist = 0;
let facingRad = 0;

/** Camera world-space position (top-left corner of the viewport). */
let cameraX = 0;
let cameraY = 0;

let shakeIntensity = 0;
let shakeDuration = 0;
let shakeStartTime = 0;
let shakeX = 0;
let shakeY = 0;

// -- Zoom --
const ZOOM_HOLD_LEVEL = 1.6;
const ZOOM_LERP = 0.12;
let zoomTarget = 1.0;
let zoomScale = 1.0;

/**
 * Set the world-space position the camera should follow.
 * @param x - Target X in world pixels.
 * @param y - Target Y in world pixels.
 */
export function setPixiCameraTarget(x: number, y: number) {
    targetX = x;
    targetY = y;
}

/**
 * Set the weapon-look offset applied in the player's facing direction.
 * @param distance - How far ahead of the player the camera shifts (world pixels).
 * @param rad - Facing angle in radians.
 */
export function setPixiCameraWeaponOffset(distance: number, rad: number) {
    offsetDist = distance;
    facingRad = rad;
}

/**
 * Advance the camera one frame. Lerps the weapon offset, centers on the target,
 * and applies quadratic-decay screen shake.
 *
 * The shake magnitude decays as `(1 - (t/duration)^2)` so the initial jolt is
 * strong and tapers smoothly to zero.
 *
 * @param viewportWidth - Current viewport width in CSS pixels.
 * @param viewportHeight - Current viewport height in CSS pixels.
 */
export function updatePixiCamera(viewportWidth: number, viewportHeight: number) {
    const targetOffsetX = Math.cos(facingRad) * offsetDist;
    const targetOffsetY = Math.sin(facingRad) * offsetDist;
    currentOffsetX += (targetOffsetX - currentOffsetX) * cameraConfig.lerpFactor;
    currentOffsetY += (targetOffsetY - currentOffsetY) * cameraConfig.lerpFactor;

    // Smooth zoom transition
    zoomScale += (zoomTarget - zoomScale) * ZOOM_LERP;

    // Effective viewport in world space shrinks when zoomed in
    const effectiveW = viewportWidth / zoomScale;
    const effectiveH = viewportHeight / zoomScale;

    cameraX = targetX + currentOffsetX - effectiveW / 2;
    cameraY = targetY + currentOffsetY - effectiveH / 2;

    const elapsed = performance.now() - shakeStartTime;
    if (elapsed < shakeDuration) {
        const t = elapsed / shakeDuration;
        const decay = 1 - t * t;
        const mag = shakeIntensity * decay;
        shakeX = (Math.random() - 0.5) * 2 * mag;
        shakeY = (Math.random() - 0.5) * 2 * mag;
    }

    else {
        shakeX = 0;
        shakeY = 0;
    }

    worldContainer.scale.set(zoomScale);
    worldContainer.x = Math.round((-cameraX + shakeX) * zoomScale);
    worldContainer.y = Math.round((-cameraY + shakeY) * zoomScale);
}

/**
 * Trigger or extend a camera shake effect. If a shake is already active the
 * stronger intensity and longer remaining duration win.
 * @param intensity - Maximum pixel displacement per axis.
 * @param duration - Total shake duration in milliseconds.
 */
export function addCameraShake(intensity: number, duration: number) {
    const now = performance.now();
    const remaining = shakeDuration - (now - shakeStartTime);

    if (remaining > 0) {
        shakeIntensity = Math.max(shakeIntensity, intensity);
        shakeDuration = Math.max(remaining, duration);
    }

    else {
        shakeIntensity = intensity;
        shakeDuration = duration;
    }
    shakeStartTime = now;
}

const _cameraOffset = { x: 0, y: 0 };
const _screenToWorld = { x: 0, y: 0 };
const _worldToScreen = { x: 0, y: 0 };

/**
 * Return the current camera offset (world-space top-left corner of the viewport).
 * The returned object is reused -- do not cache across frames.
 */
export function getPixiCameraOffset(): { x: number; y: number } {
    _cameraOffset.x = cameraX;
    _cameraOffset.y = cameraY;
    return _cameraOffset;
}

/**
 * Convert screen-space (CSS pixel) coordinates to world-space.
 * The returned object is reused -- do not cache across frames.
 * @param sx - Screen X.
 * @param sy - Screen Y.
 */
export function pixiScreenToWorld(sx: number, sy: number): { x: number; y: number } {
    _screenToWorld.x = sx / zoomScale + cameraX;
    _screenToWorld.y = sy / zoomScale + cameraY;
    return _screenToWorld;
}

/**
 * Convert world-space coordinates to screen-space (CSS pixels).
 * The returned object is reused -- do not cache across frames.
 * @param wx - World X.
 * @param wy - World Y.
 */
export function pixiWorldToScreen(wx: number, wy: number): { x: number; y: number } {
    _worldToScreen.x = (wx - cameraX) * zoomScale;
    _worldToScreen.y = (wy - cameraY) * zoomScale;
    return _worldToScreen;
}

/** Hold-to-zoom: true zooms in, false returns to 1x. */
export function setZoomHold(active: boolean) {
    zoomTarget = active ? ZOOM_HOLD_LEVEL : 1.0;
}

/** Current zoom level. */
export function getZoomScale(): number {
    return zoomScale;
}
