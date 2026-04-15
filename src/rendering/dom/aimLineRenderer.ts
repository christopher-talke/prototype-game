import '@rendering/dom/css/aimline.css';

import { app } from '../../app';
import { HALF_HIT_BOX, ROTATION_OFFSET, MAP_OFFSET } from '../../constants';
import { angleToRadians } from '@utils/angleToRadians';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getWeaponDef } from '@simulation/combat/weapons';
import { getGrenadeDef } from '@simulation/combat/grenades';
import { raySegmentIntersect } from '@simulation/detection/rayGeometry';
import { environment } from '@simulation/environment/environment';
import { getConfig } from '@config/activeConfig';
import { aimLineConfig } from '../canvas/config/aimLineConfig';

let adsActive = false;

let aimLineEl: HTMLElement | null = null;
let aimConeLeft: HTMLElement | null = null;
let aimConeRight: HTMLElement | null = null;
let grenadeAimEl: HTMLElement | null = null;

let mouseClientX = 0;
let mouseClientY = 0;

const INDICATOR_TIP_OFFSET = aimLineConfig.indicatorTipOffset;
const SPREAD_GROWTH_PER_SHOT = aimLineConfig.spreadGrowthPerShot;
const MAX_SPREAD_MULTIPLIER = aimLineConfig.maxSpreadMultiplier;

export function initADS() {
    window.addEventListener('mousedown', (e) => { if (e.button === 2) adsActive = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) adsActive = false; });
    window.addEventListener('mousemove', (e) => { mouseClientX = e.clientX; mouseClientY = e.clientY; });
}

export function updateAimLine(playerInfo: player_info, shots: number) {
    if (!adsActive) { hideAimLine(); return; }
    if (!aimLineEl) createAimLineElements();

    const weapon = getActiveWeapon(playerInfo);
    if (!weapon) { hideAimLine(); return; }

    const weaponDef = getWeaponDef(weapon.type);
    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;
    const aimAngle = playerInfo.current_position.rotation - ROTATION_OFFSET;
    const rad = angleToRadians(aimAngle);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    const startX = cx + dx * INDICATOR_TIP_OFFSET;
    const startY = cy + dy * INDICATOR_TIP_OFFSET;

    const mouseWorldX = mouseClientX + window.scrollX - MAP_OFFSET;
    const mouseWorldY = mouseClientY + window.scrollY - MAP_OFFSET;
    const toCrosshairDist = Math.sqrt((mouseWorldX - startX) ** 2 + (mouseWorldY - startY) ** 2);

    const spreadMult = Math.min(1 + shots * SPREAD_GROWTH_PER_SHOT, MAX_SPREAD_MULTIPLIER);
    const currentSpread = weaponDef.spread * spreadMult;
    const halfSpread = currentSpread / 2;
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

    aimLineEl!.style.display = 'block';
    aimLineEl!.style.left = `${startX}px`;
    aimLineEl!.style.top = `${startY}px`;
    aimLineEl!.style.width = `${lineLen}px`;
    aimLineEl!.style.transform = `rotate(${aimAngle}deg)`;

    aimConeLeft!.style.display = 'block';
    aimConeLeft!.style.left = `${startX}px`;
    aimConeLeft!.style.top = `${startY}px`;
    aimConeLeft!.style.width = `${leftLen}px`;
    aimConeLeft!.style.transform = `rotate(${leftAngle}deg)`;

    aimConeRight!.style.display = 'block';
    aimConeRight!.style.left = `${startX}px`;
    aimConeRight!.style.top = `${startY}px`;
    aimConeRight!.style.width = `${rightLen}px`;
    aimConeRight!.style.transform = `rotate(${rightAngle}deg)`;
}

function createAimLineElements() {
    if (!app) return;

    aimLineEl = document.createElement('div');
    aimLineEl.classList.add('aim-line', 'aim-center');
    app.appendChild(aimLineEl);

    aimConeLeft = document.createElement('div');
    aimConeLeft.classList.add('aim-line', 'aim-cone');
    app.appendChild(aimConeLeft);

    aimConeRight = document.createElement('div');
    aimConeRight.classList.add('aim-line', 'aim-cone');
    app.appendChild(aimConeRight);
}

function hideAimLine() {
    if (aimLineEl) aimLineEl.style.display = 'none';
    if (aimConeLeft) aimConeLeft.style.display = 'none';
    if (aimConeRight) aimConeRight.style.display = 'none';
}

function computeGrenadeTravelDistance(throwSpeed: number, chargeFraction: number): number {
    const friction = getConfig().physics.grenadeFriction;
    const minSpeed = 0.3;
    let speed = throwSpeed * chargeFraction;
    let dist = 0;
    while (speed > minSpeed) {
        dist += speed;
        speed *= friction;
    }
    return dist;
}

export function updateGrenadeAimLine(playerInfo: player_info, chargePercent: number, selectedType: GrenadeType) {
    if (chargePercent <= 0) { hideGrenadeAimLine(); return; }

    if (app && !grenadeAimEl) {
        grenadeAimEl = document.createElement('div');
        grenadeAimEl.classList.add('aim-line', 'aim-grenade');
        app.appendChild(grenadeAimEl);
    }

    const type = selectedType;
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

    if (grenadeAimEl) {
        grenadeAimEl.style.display = 'block';
        grenadeAimEl.style.left = `${startX}px`;
        grenadeAimEl.style.top = `${startY}px`;
        grenadeAimEl.style.width = `${lineLen}px`;
        grenadeAimEl.style.transform = `rotate(${aimAngle}deg)`;
    }
}

function hideGrenadeAimLine() {
    if (grenadeAimEl) grenadeAimEl.style.display = 'none';
}
