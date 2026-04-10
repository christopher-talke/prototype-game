import { worldContainer } from './pixiSceneGraph';

let currentOffsetX = 0;
let currentOffsetY = 0;

let targetX = 0;
let targetY = 0;
let offsetDist = 0;
let facingRad = 0;

// Camera position: world coordinates at the top-left corner of the viewport
let cameraX = 0;
let cameraY = 0;

export function setPixiCameraTarget(x: number, y: number) {
    targetX = x;
    targetY = y;
}

export function setPixiCameraWeaponOffset(distance: number, rad: number) {
    offsetDist = distance;
    facingRad = rad;
}

export function updatePixiCamera(viewportWidth: number, viewportHeight: number) {
    const targetOffsetX = Math.cos(facingRad) * offsetDist;
    const targetOffsetY = Math.sin(facingRad) * offsetDist;
    currentOffsetX += (targetOffsetX - currentOffsetX) * 0.18;
    currentOffsetY += (targetOffsetY - currentOffsetY) * 0.18;

    cameraX = targetX + currentOffsetX - viewportWidth / 2;
    cameraY = targetY + currentOffsetY - viewportHeight / 2;

    worldContainer.x = Math.round(-cameraX);
    worldContainer.y = Math.round(-cameraY);
}

export function getPixiCameraOffset(): { x: number; y: number } {
    return { x: cameraX, y: cameraY };
}

export function pixiScreenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + cameraX, y: sy + cameraY };
}

export function pixiWorldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - cameraX, y: wy - cameraY };
}
