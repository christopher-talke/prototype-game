import { Graphics } from 'pixi.js';
import { fogOfWarLayer, fovConeLayer } from './pixiSceneGraph';
import { getPixiCameraOffset } from './pixiCamera';
import { computeFOVCone } from '@simulation/detection/raycast';

// A large margin so the cut polygon is always fully enclosed within the mask rect
const MASK_MARGIN = 6000;

let fogOverlay: Graphics | null = null;
let fogDrawer: Graphics | null = null;

let fovLineLeft: Graphics | null = null;
let fovLineRight: Graphics | null = null;

export function initPixiFogOfWar(worldWidth: number, worldHeight: number) {
    fogOverlay = new Graphics();
    fogOverlay.rect(0, 0, worldWidth, worldHeight).fill({ color: 0x0f0f1a, alpha: 0.85 });
    fogOfWarLayer.addChild(fogOverlay);

    // fogDrawer is not added to the scene graph -- its identity transform puts it in screen space.
    // The mask is applied in the local space of fogOverlay's parent (worldContainer),
    // but since fogDrawer has no parent its worldTransform is identity = screen space.
    // We compensate by converting world vertices to screen space before drawing.
    fogDrawer = new Graphics();
    fogOverlay.mask = fogDrawer;

    fovLineLeft = new Graphics();
    fovLineRight = new Graphics();
    fovConeLayer.addChild(fovLineLeft);
    fovConeLayer.addChild(fovLineRight);
}

export function updatePixiFogOfWar(vertices: coordinates[], count: number) {
    if (!fogDrawer || !fogOverlay) return;
    if (!fogOverlay.visible) fogOverlay.visible = true;

    const vp = window.visualViewport!;
    const vpWidth = vp.width;
    const vpHeight = vp.height;
    const { x: cameraX, y: cameraY } = getPixiCameraOffset();

    // Build fog mask: white rect with visibility polygon cut out.
    // All coords are screen-space (world - camera).
    fogDrawer.clear();
    fogDrawer
        .rect(-MASK_MARGIN, -MASK_MARGIN, vpWidth + MASK_MARGIN * 2, vpHeight + MASK_MARGIN * 2)
        .fill(0xffffff);

    const pts: number[] = [];
    for (let i = 0; i < count; i++) {
        pts.push(vertices[i].x - cameraX, vertices[i].y - cameraY);
    }
    fogDrawer.poly(pts).cut();
}

export function hidePixiFog() {
    if (fogOverlay) fogOverlay.visible = false;
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
