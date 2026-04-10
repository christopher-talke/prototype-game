import { Graphics } from 'pixi.js';
import { aimLineLayer } from './pixiSceneGraph';
import { pixiScreenToWorld } from './pixiCamera';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../../constants';
import { angleToRadians } from '@utils/angleToRadians';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getWeaponDef } from '@simulation/combat/weapons';
import { getGrenadeDef } from '@simulation/combat/grenades';
import { raySegmentIntersect } from '@simulation/detection/rayGeometry';
import { environment } from '@simulation/environment/environment';
import { getGrenadeChargePercent, getSelectedGrenadeType } from '@simulation/inputController';
import { getConfig } from '@config/activeConfig';

let adsActive = false;
let mouseClientX = 0;
let mouseClientY = 0;

let aimLineG: Graphics | null = null;
let aimConeLeftG: Graphics | null = null;
let aimConeRightG: Graphics | null = null;
let grenadeAimG: Graphics | null = null;

const INDICATOR_TIP_OFFSET = 27;
const SPREAD_GROWTH_PER_SHOT = 0.4;
const MAX_SPREAD_MULTIPLIER = 3;

export function initPixiAimLine() {
    window.addEventListener('mousedown', (e) => { if (e.button === 2) adsActive = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) adsActive = false; });
    window.addEventListener('mousemove', (e) => { mouseClientX = e.clientX; mouseClientY = e.clientY; });

    aimLineG = new Graphics();
    aimConeLeftG = new Graphics();
    aimConeRightG = new Graphics();
    grenadeAimG = new Graphics();
    aimLineLayer.addChild(aimLineG);
    aimLineLayer.addChild(aimConeLeftG);
    aimLineLayer.addChild(aimConeRightG);
    aimLineLayer.addChild(grenadeAimG);
}

export function updatePixiAimLine(playerInfo: player_info, shots: number) {
    if (!aimLineG || !aimConeLeftG || !aimConeRightG) return;

    if (!adsActive) {
        aimLineG.clear(); aimConeLeftG.clear(); aimConeRightG.clear();
        return;
    }

    const weapon = getActiveWeapon(playerInfo);
    if (!weapon) {
        aimLineG.clear(); aimConeLeftG.clear(); aimConeRightG.clear();
        return;
    }

    const weaponDef = getWeaponDef(weapon.type);
    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;
    const aimAngle = playerInfo.current_position.rotation - ROTATION_OFFSET;
    const rad = angleToRadians(aimAngle);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    const startX = cx + dx * INDICATOR_TIP_OFFSET;
    const startY = cy + dy * INDICATOR_TIP_OFFSET;

    const mouseWorld = pixiScreenToWorld(mouseClientX, mouseClientY);
    const toCrosshairDist = Math.sqrt((mouseWorld.x - startX) ** 2 + (mouseWorld.y - startY) ** 2);

    const spreadMult = Math.min(1 + shots * SPREAD_GROWTH_PER_SHOT, MAX_SPREAD_MULTIPLIER);
    const halfSpread = (weaponDef.spread * spreadMult) / 2;
    const leftAngle = aimAngle - halfSpread;
    const rightAngle = aimAngle + halfSpread;
    const ldx = Math.cos(angleToRadians(leftAngle));
    const ldy = Math.sin(angleToRadians(leftAngle));
    const rdx = Math.cos(angleToRadians(rightAngle));
    const rdy = Math.sin(angleToRadians(rightAngle));

    let lineLen = toCrosshairDist;
    let leftLen = toCrosshairDist;
    let rightLen = toCrosshairDist;
    for (const seg of environment.segments) {
        const tc = raySegmentIntersect(startX, startY, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (tc !== null && tc > 0 && tc < lineLen) lineLen = tc;
        const tl = raySegmentIntersect(startX, startY, ldx, ldy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (tl !== null && tl > 0 && tl < leftLen) leftLen = tl;
        const tr = raySegmentIntersect(startX, startY, rdx, rdy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (tr !== null && tr > 0 && tr < rightLen) rightLen = tr;
    }

    aimLineG.clear()
        .moveTo(startX, startY)
        .lineTo(startX + dx * lineLen, startY + dy * lineLen)
        .stroke({ color: 0xffffff, alpha: 0.8, width: 1 });

    aimConeLeftG.clear()
        .moveTo(startX, startY)
        .lineTo(startX + ldx * leftLen, startY + ldy * leftLen)
        .stroke({ color: 0xffffff, alpha: 0.35, width: 1 });

    aimConeRightG.clear()
        .moveTo(startX, startY)
        .lineTo(startX + rdx * rightLen, startY + rdy * rightLen)
        .stroke({ color: 0xffffff, alpha: 0.35, width: 1 });
}

function computeGrenadeTravelDistance(throwSpeed: number, chargeFraction: number): number {
    const friction = getConfig().physics.grenadeFriction;
    let speed = throwSpeed * chargeFraction;
    let dist = 0;
    while (speed > 0.3) { dist += speed; speed *= friction; }
    return dist;
}

export function updatePixiGrenadeAimLine(playerInfo: player_info) {
    if (!grenadeAimG) return;

    const chargePercent = getGrenadeChargePercent();
    if (chargePercent <= 0) { grenadeAimG.clear(); return; }

    const type = getSelectedGrenadeType();
    const def = getGrenadeDef(type);
    const minFraction = getConfig().grenades.minThrowFraction;
    const chargeFraction = minFraction + (1 - minFraction) * chargePercent;

    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;
    const aimAngle = playerInfo.current_position.rotation - ROTATION_OFFSET;
    const rad = angleToRadians(aimAngle);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    const startX = cx + dx * INDICATOR_TIP_OFFSET;
    const startY = cy + dy * INDICATOR_TIP_OFFSET;

    let lineLen = computeGrenadeTravelDistance(def.throwSpeed, chargeFraction);
    for (const seg of environment.segments) {
        const t = raySegmentIntersect(startX, startY, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t > 0 && t < lineLen) lineLen = t;
    }

    grenadeAimG.clear()
        .moveTo(startX, startY)
        .lineTo(startX + dx * lineLen, startY + dy * lineLen)
        .stroke({ color: 0xffcc00, alpha: 0.7, width: 2 });
}
