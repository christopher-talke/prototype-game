import { MAP_OFFSET } from '../constants';

let currentOffsetX = 0;
let currentOffsetY = 0;
let lastScrollX = NaN;
let lastScrollY = NaN;

let targetX = 0;
let targetY = 0;
let offsetDist = 0;
let facingRad = 0;

export function setCameraTarget(x: number, y: number) {
    targetX = x;
    targetY = y;
}

export function setCameraWeaponOffset(distance: number, rad: number) {
    offsetDist = distance;
    facingRad = rad;
}

export function updateCamera(viewportWidth: number, viewportHeight: number) {
    const targetOffsetX = Math.cos(facingRad) * offsetDist;
    const targetOffsetY = Math.sin(facingRad) * offsetDist;
    currentOffsetX += (targetOffsetX - currentOffsetX) * 0.18;
    currentOffsetY += (targetOffsetY - currentOffsetY) * 0.18;

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

export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
        x: worldX + MAP_OFFSET - lastScrollX,
        y: worldY + MAP_OFFSET - lastScrollY,
    };
}
