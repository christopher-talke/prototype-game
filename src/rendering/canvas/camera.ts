import { worldContainer } from './sceneGraph';

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

const _cameraOffset = { x: 0, y: 0 };
const _screenToWorld = { x: 0, y: 0 };
const _worldToScreen = { x: 0, y: 0 };

export function getPixiCameraOffset(): { x: number; y: number } {
    _cameraOffset.x = cameraX;
    _cameraOffset.y = cameraY;
    return _cameraOffset;
}

export function pixiScreenToWorld(sx: number, sy: number): { x: number; y: number } {
    _screenToWorld.x = sx + cameraX;
    _screenToWorld.y = sy + cameraY;
    return _screenToWorld;
}

export function pixiWorldToScreen(wx: number, wy: number): { x: number; y: number } {
    _worldToScreen.x = wx - cameraX;
    _worldToScreen.y = wy - cameraY;
    return _worldToScreen;
}
