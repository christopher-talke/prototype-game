import './aimline.css';
import { app } from '../main';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { angleToRadians } from '../Utilities/angleToRadians';
import { getActiveWeapon, getConsecutiveShots } from '../Combat/shooting';
import { getWeaponDef } from '../Combat/weapons';
import { raySegmentIntersect } from './Raycast/raycast';
import { environment } from '../Environment/environment';
import { MAP_OFFSET } from '../constants';

let adsActive = false;
let aimLineEl: HTMLElement | null = null;
let aimConeLeft: HTMLElement | null = null;
let aimConeRight: HTMLElement | null = null;
let mouseClientX = 0;
let mouseClientY = 0;

const INDICATOR_TIP_OFFSET = 27;
const SPREAD_GROWTH_PER_SHOT = 0.4;
const MAX_SPREAD_MULTIPLIER = 3;

export function isADS(): boolean {
    return adsActive;
}

export function initADS() {
    window.addEventListener('mousedown', (e) => {
        if (e.button === 2) adsActive = true;
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 2) adsActive = false;
    });
    window.addEventListener('mousemove', (e) => {
        mouseClientX = e.clientX;
        mouseClientY = e.clientY;
    });
}

export function updateAimLine(playerInfo: player_info) {
    if (!adsActive) {
        hideAimLine();
        return;
    }

    if (!aimLineEl) createAimLineElements();

    const weapon = getActiveWeapon(playerInfo);
    if (!weapon) {
        hideAimLine();
        return;
    }

    const weaponDef = getWeaponDef(weapon.type);
    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;
    const aimAngle = playerInfo.current_position.rotation - ROTATION_OFFSET;
    const rad = angleToRadians(aimAngle);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    // Start from tip of direction indicator
    const startX = cx + dx * INDICATOR_TIP_OFFSET;
    const startY = cy + dy * INDICATOR_TIP_OFFSET;

    // Distance from start to crosshair (mouse world position)
    const mouseWorldX = mouseClientX + window.scrollX - MAP_OFFSET;
    const mouseWorldY = mouseClientY + window.scrollY - MAP_OFFSET;
    const toCrosshairDist = Math.sqrt((mouseWorldX - startX) ** 2 + (mouseWorldY - startY) ** 2);

    // Find wall hit distance, capped at crosshair distance
    let lineLen = toCrosshairDist;
    for (const seg of environment.segments) {
        const t = raySegmentIntersect(startX, startY, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t > 0 && t < lineLen) {
            lineLen = t;
        }
    }

    // Spread calculation
    const shots = getConsecutiveShots();
    const spreadMult = Math.min(1 + shots * SPREAD_GROWTH_PER_SHOT, MAX_SPREAD_MULTIPLIER);
    const baseSpread = weaponDef.spread;
    const currentSpread = baseSpread * spreadMult;

    // Center line
    aimLineEl!.style.display = 'block';
    aimLineEl!.style.left = `${startX}px`;
    aimLineEl!.style.top = `${startY}px`;
    aimLineEl!.style.width = `${lineLen}px`;
    aimLineEl!.style.transform = `rotate(${aimAngle}deg)`;

    // Cone edges
    const halfSpread = currentSpread / 2;
    const leftAngle = aimAngle - halfSpread;
    const rightAngle = aimAngle + halfSpread;

    // Find wall distance for cone edges
    const leftRad = angleToRadians(leftAngle);
    const rightRad = angleToRadians(rightAngle);
    let leftLen = toCrosshairDist;
    let rightLen = toCrosshairDist;
    for (const seg of environment.segments) {
        const tl = raySegmentIntersect(startX, startY, Math.cos(leftRad), Math.sin(leftRad), seg.x1, seg.y1, seg.x2, seg.y2);
        if (tl !== null && tl > 0 && tl < leftLen) leftLen = tl;
        const tr = raySegmentIntersect(startX, startY, Math.cos(rightRad), Math.sin(rightRad), seg.x1, seg.y1, seg.x2, seg.y2);
        if (tr !== null && tr > 0 && tr < rightLen) rightLen = tr;
    }

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
