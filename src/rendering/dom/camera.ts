/**
 * DOM camera system. Positions the viewport by scrolling the window to keep
 * the local player centered, with a weapon-offset lerp for look-ahead feel.
 * Part of the DOM rendering layer -- consumed by the game loop each frame.
 */

import { MAP_OFFSET } from '../../constants';
import { cameraConfig } from '../canvas/config/cameraConfig';

let currentOffsetX = 0;
let currentOffsetY = 0;
let lastScrollX = NaN;
let lastScrollY = NaN;

let targetX = 0;
let targetY = 0;
let offsetDist = 0;
let facingRad = 0;

/**
 * Sets the world-space position the camera should center on.
 * @param x - Target X in world coordinates
 * @param y - Target Y in world coordinates
 */
export function setCameraTarget(x: number, y: number) {
    targetX = x;
    targetY = y;
}

/**
 * Sets the weapon look-ahead offset applied on top of the camera target.
 * @param distance - Offset distance in pixels
 * @param rad - Facing direction in radians
 */
export function setCameraWeaponOffset(distance: number, rad: number) {
    offsetDist = distance;
    facingRad = rad;
}

/**
 * Scrolls the window so the camera target (plus weapon offset) is centered
 * in the viewport. Skips redundant scrollTo calls when position has not changed.
 * Called once per frame from the game loop.
 * @param viewportWidth - Current viewport width in pixels
 * @param viewportHeight - Current viewport height in pixels
 */
export function updateCamera(viewportWidth: number, viewportHeight: number) {
    const targetOffsetX = Math.cos(facingRad) * offsetDist;
    const targetOffsetY = Math.sin(facingRad) * offsetDist;
    currentOffsetX += (targetOffsetX - currentOffsetX) * cameraConfig.lerpFactor;
    currentOffsetY += (targetOffsetY - currentOffsetY) * cameraConfig.lerpFactor;

    const cameraX = targetX + currentOffsetX + MAP_OFFSET - viewportWidth / 2;
    const cameraY = targetY + currentOffsetY + MAP_OFFSET - viewportHeight / 2;
    const roundedCX = Math.round(cameraX);
    const roundedCY = Math.round(cameraY);
    if (roundedCX !== lastScrollX || roundedCY !== lastScrollY) {
        lastScrollX = roundedCX;
        lastScrollY = roundedCY;
        window.scrollTo(roundedCX, roundedCY);
    }
}

/**
 * Converts world coordinates to screen-space coordinates relative to the viewport.
 * @param worldX - X position in world space
 * @param worldY - Y position in world space
 * @returns Screen-space coordinates
 */
export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
        x: worldX + MAP_OFFSET - lastScrollX,
        y: worldY + MAP_OFFSET - lastScrollY,
    };
}

/**
 * Return the current DOM camera offset (world-space top-left of the viewport).
 * Semantics match `getPixiCameraOffset()` from the canvas camera.
 * The returned object is freshly allocated each call.
 */
export function getDomCameraOffset(): { x: number; y: number } {
    return {
        x: (lastScrollX || 0) - MAP_OFFSET,
        y: (lastScrollY || 0) - MAP_OFFSET,
    };
}
