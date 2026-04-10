import { Graphics, Sprite, Texture } from 'pixi.js';
import { backgroundLayer, fogOfWarLayer, fovConeLayer } from './pixiSceneGraph';
import { getPixiCameraOffset } from './pixiCamera';
import { computeFOVCone } from '@simulation/detection/raycast';

// Must be larger than max ray distance (5000px) so the cut polygon is always enclosed
const FOG_MARGIN = 6000;
// Gradient disc radius in world units - covers the full view range
const FALLOFF_RADIUS = 1600;
const FALLOFF_TEX_SIZE = 512;

let fogTint: Graphics | null = null;    // subtle tint in visible area, below walls
let fogOverlay: Graphics | null = null; // dark overlay above walls with visibility cut
let falloffSprite: Sprite | null = null; // radial gradient for distance falloff

let fovLineLeft: Graphics | null = null;
let fovLineRight: Graphics | null = null;

function buildFalloffTexture(): Texture {
    const s = FALLOFF_TEX_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext('2d')!;
    const r = s / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0,   'rgba(0,0,0,0)');    // bright at player
    grad.addColorStop(0.4, 'rgba(0,0,0,0)');    // still fully lit close range
    grad.addColorStop(1,   'rgba(0,0,0,0.65)'); // dim at far edge of vision
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    return Texture.from(canvas);
}

export function initPixiFogOfWar() {
    fogTint = new Graphics();
    backgroundLayer.addChild(fogTint);

    fogOverlay = new Graphics();
    fogOfWarLayer.addChild(fogOverlay);

    falloffSprite = new Sprite(buildFalloffTexture());
    falloffSprite.anchor.set(0.5);
    falloffSprite.scale.set((FALLOFF_RADIUS * 2) / FALLOFF_TEX_SIZE);
    fogOfWarLayer.addChild(falloffSprite);

    fovLineLeft = new Graphics();
    fovLineRight = new Graphics();
    fovConeLayer.addChild(fovLineLeft);
    fovConeLayer.addChild(fovLineRight);
}

export function updatePixiFogOfWar(vertices: coordinates[], count: number) {
    if (!fogOverlay || !fogTint || !falloffSprite) return;

    const { x: cameraX, y: cameraY } = getPixiCameraOffset();
    const vp = window.visualViewport!;

    const pts: number[] = [];
    for (let i = 0; i < count; i++) pts.push(vertices[i].x, vertices[i].y);

    // 1. Subtle blue-white tint on visible area floor (below walls, matches CSS)
    fogTint.visible = true;
    fogTint.clear();
    fogTint.poly(pts).fill({ color: 0xc8dcff, alpha: 0.12 });

    // 2. Dark overlay with polygon cut (above walls, primary lighting effect)
    fogOverlay.visible = true;
    fogOverlay.clear();
    fogOverlay
        .rect(cameraX - FOG_MARGIN, cameraY - FOG_MARGIN,
              vp.width + FOG_MARGIN * 2, vp.height + FOG_MARGIN * 2)
        .fill({ color: 0x050508, alpha: 1 });
    fogOverlay.poly(pts).cut();

    // 3. Distance falloff: gradient disc centered on player dims far edges of the cone
    falloffSprite.visible = true;
    falloffSprite.x = vertices[0].x; // vertex 0 is always the player center
    falloffSprite.y = vertices[0].y;
}

export function hidePixiFog() {
    if (fogTint) fogTint.visible = false;
    if (fogOverlay) fogOverlay.visible = false;
    if (falloffSprite) falloffSprite.visible = false;
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
