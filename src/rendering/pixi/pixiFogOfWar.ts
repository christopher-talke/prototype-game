import { Graphics } from 'pixi.js';
import { backgroundLayer, fovConeLayer } from './pixiSceneGraph';
import { getPixiCameraOffset } from './pixiCamera';
import { computeFOVCone } from '@simulation/detection/raycast';

// Must be larger than max ray distance (5000px) so the cut polygon is always enclosed
const FOG_MARGIN = 6000;

// Both in backgroundLayer so walls/players always render on top
let fogOverlay: Graphics | null = null; // dark overlay with visibility cut, below walls
let fogTint: Graphics | null = null;    // subtle tint on visible area, below walls

let fovLineLeft: Graphics | null = null;
let fovLineRight: Graphics | null = null;

export function initPixiFogOfWar() {
    fogOverlay = new Graphics();
    backgroundLayer.addChild(fogOverlay);

    fogTint = new Graphics();
    backgroundLayer.addChild(fogTint);

    fovLineLeft = new Graphics();
    fovLineRight = new Graphics();
    fovConeLayer.addChild(fovLineLeft);
    fovConeLayer.addChild(fovLineRight);
}

export function updatePixiFogOfWar(vertices: coordinates[], count: number) {
    if (!fogOverlay || !fogTint) return;

    const { x: cameraX, y: cameraY } = getPixiCameraOffset();
    const vp = window.visualViewport!;

    const pts: number[] = [];
    for (let i = 0; i < count; i++) pts.push(vertices[i].x, vertices[i].y);

    // Dark floor outside visibility polygon (below walls -- walls always visible on top)
    fogOverlay.visible = true;
    fogOverlay.clear();
    fogOverlay
        .rect(cameraX - FOG_MARGIN, cameraY - FOG_MARGIN,
              vp.width + FOG_MARGIN * 2, vp.height + FOG_MARGIN * 2)
        .fill({ color: 0x050508, alpha: 1 });
    fogOverlay.poly(pts).cut();

    // Subtle blue-white tint on the visible floor area
    fogTint.visible = true;
    fogTint.clear();
    fogTint.poly(pts).fill({ color: 0xc8dcff, alpha: 0.12 });
}

export function hidePixiFog() {
    if (fogOverlay) fogOverlay.visible = false;
    if (fogTint) fogTint.visible = false;
}

export function updatePixiFOVCone(playerInfo: player_info) {
    if (!fovLineLeft || !fovLineRight) return;

    const cone = computeFOVCone(playerInfo);
    const DEG_TO_RAD = Math.PI / 180;
    const lRad = cone.lowerAngle * DEG_TO_RAD;
    const uRad = cone.upperAngle * DEG_TO_RAD;

    fovLineLeft.clear();
    fovLineLeft
        .moveTo(cone.cx, cone.cy)
        .lineTo(cone.cx + Math.cos(lRad) * cone.leftLen, cone.cy + Math.sin(lRad) * cone.leftLen)
        .stroke({ color: 0xffffff, alpha: 0.3, width: 1 });

    fovLineRight.clear();
    fovLineRight
        .moveTo(cone.cx, cone.cy)
        .lineTo(cone.cx + Math.cos(uRad) * cone.rightLen, cone.cy + Math.sin(uRad) * cone.rightLen)
        .stroke({ color: 0xffffff, alpha: 0.3, width: 1 });
}

export function hidePixiFOVCone() {
    fovLineLeft?.clear();
    fovLineRight?.clear();
}
