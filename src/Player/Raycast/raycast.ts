import { environment } from '../../Environment/environment';
import { app, SETTINGS } from '../../Globals/App';
import { getAngle } from '../../Utilities/getAngle';
import { getDistance } from '../../Utilities/getDistance';
import { HALF_HIT_BOX, FOV, CORNER_RAY_OFFSET_DEGREES } from '../../constants';
import { isSmoked } from '../../Combat/smoke';
import { raySegmentIntersect, isLineBlocked as _geoLineBlocked } from './rayGeometry';

export enum RaycastTypes {
    SPRAY = 'SPRAY',
    CORNERS = 'CORNERS',
}

// --- Angle utilities ---

function normalizeAngle(a: number): number {
    a = a % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}

function isAngleInFOV(angle: number, center: number, halfFov: number): boolean {
    const diff = normalizeAngle(angle - center);
    return diff > -halfFov && diff < halfFov;
}

const DEG_TO_RAD = Math.PI / 180;
function angleToRadians(deg: number): number {
    return DEG_TO_RAD * deg;
}

export { raySegmentIntersect } from './rayGeometry';

// --- isLineBlocked: thin wrapper adding smoke check over geometry-only version ---

export function isLineBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    if (isSmoked(sx, sy, tx, ty)) return true;
    return _geoLineBlocked(sx, sy, tx, ty, segments);
}

// --- Frame skipping: skip raycast if player hasn't moved or rotated ---

let lastCastX = NaN;
let lastCastY = NaN;
let lastCastRot = NaN;
const POSITION_THRESHOLD = 0.5;
const ROTATION_THRESHOLD = 0.5;

// --- Pre-allocated reusable buffers ---
const rayPathBuffer: RayPoint[] = [];
let polyStringParts: string[] = [];

// --- Segment pre-filtering: AABB overlap test ---

// Reusable buffer for filtered segments (avoids allocation per frame)
const _filteredSegments: WallSegment[] = [];

function filterSegmentsByFOV(
    cx: number, cy: number,
    lowerRad: number, upperRad: number,
    maxDist: number,
    segments: WallSegment[],
): WallSegment[] {
    // Compute bounding box of the FOV cone
    const cosL = Math.cos(lowerRad);
    const sinL = Math.sin(lowerRad);
    const cosU = Math.cos(upperRad);
    const sinU = Math.sin(upperRad);

    const endLX = cx + cosL * maxDist;
    const endLY = cy + sinL * maxDist;
    const endUX = cx + cosU * maxDist;
    const endUY = cy + sinU * maxDist;

    let minX = cx, maxX = cx, minY = cy, maxY = cy;
    if (endLX < minX) minX = endLX; if (endLX > maxX) maxX = endLX;
    if (endLY < minY) minY = endLY; if (endLY > maxY) maxY = endLY;
    if (endUX < minX) minX = endUX; if (endUX > maxX) maxX = endUX;
    if (endUY < minY) minY = endUY; if (endUY > maxY) maxY = endUY;

    // Expand slightly for safety (corners at edges)
    const pad = 50;
    minX -= pad; minY -= pad;
    maxX += pad; maxY += pad;

    const result = _filteredSegments;
    result.length = 0;
    for (const seg of segments) {
        const segMinX = seg.x1 < seg.x2 ? seg.x1 : seg.x2;
        const segMaxX = seg.x1 > seg.x2 ? seg.x1 : seg.x2;
        const segMinY = seg.y1 < seg.y2 ? seg.y1 : seg.y2;
        const segMaxY = seg.y1 > seg.y2 ? seg.y1 : seg.y2;

        if (segMaxX >= minX && segMinX <= maxX && segMaxY >= minY && segMinY <= maxY) {
            result.push(seg);
        }
    }
    return result;
}

// --- castRay: inlined segment iteration for performance ---

function castRay(originX: number, originY: number, dirX: number, dirY: number, segments: WallSegment[], outPoint: coordinates): void {
    let nearestT = Infinity;

    for (let i = 0, len = segments.length; i < len; i++) {
        const seg = segments[i];
        const t = raySegmentIntersect(originX, originY, dirX, dirY, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t < nearestT) {
            nearestT = t;
        }
    }

    if (nearestT === Infinity) nearestT = 5000;

    outPoint.x = originX + dirX * nearestT;
    outPoint.y = originY + dirY * nearestT;
}

// Reusable temp points to avoid allocations
const _lowerHit: coordinates = { x: 0, y: 0 };
const _upperHit: coordinates = { x: 0, y: 0 };
const _hitA: coordinates = { x: 0, y: 0 };
const _hitB: coordinates = { x: 0, y: 0 };

// --- Distance-based corner culling ---
const MAX_CORNER_DIST_SQ = 1500 * 1500;

export function generateRayCast(playerInfo: player_info, config: raycast_config) {
    const centerX = playerInfo.current_position.x + HALF_HIT_BOX;
    const centerY = playerInfo.current_position.y + HALF_HIT_BOX;
    const rotation = playerInfo.current_position.rotation;

    // Frame skipping: skip if player hasn't moved or rotated
    const dx = centerX - lastCastX;
    const dy = centerY - lastCastY;
    const dr = Math.abs(normalizeAngle(rotation - lastCastRot));
    if (dx * dx + dy * dy < POSITION_THRESHOLD * POSITION_THRESHOLD && dr < ROTATION_THRESHOLD) return;

    lastCastX = centerX;
    lastCastY = centerY;
    lastCastRot = rotation;

    if (SETTINGS.debug) {
        for (const el of Array.from(document.querySelectorAll('.ray'))) el.remove();
    }

    const facingAngle = rotation - 90;
    const lowerLimit = facingAngle - FOV;
    const upperLimit = facingAngle + FOV;

    const lowerRad = angleToRadians(lowerLimit);
    const upperRad = angleToRadians(upperLimit);

    // Pre-filter segments by FOV bounding box
    const filteredSegments = filterSegmentsByFOV(centerX, centerY, lowerRad, upperRad, 5000, environment.segments);

    // Boundary rays (pre-compute direction vectors)
    const lowerDirX = Math.cos(lowerRad);
    const lowerDirY = Math.sin(lowerRad);
    const upperDirX = Math.cos(upperRad);
    const upperDirY = Math.sin(upperRad);

    castRay(centerX, centerY, lowerDirX, lowerDirY, filteredSegments, _lowerHit);
    castRay(centerX, centerY, upperDirX, upperDirY, filteredSegments, _upperHit);

    // Reuse ray path buffer
    let rayCount = 0;

    if (config.type === 'CORNERS') {
        const corners = environment.corners;
        for (let ci = 0, clen = corners.length; ci < clen; ci++) {
            const corner = corners[ci];

            // Distance culling (squared, no sqrt)
            const cdx = corner.x - centerX;
            const cdy = corner.y - centerY;
            if (cdx * cdx + cdy * cdy > MAX_CORNER_DIST_SQ) continue;

            const angleToCorner = getAngle(centerX, centerY, corner.x, corner.y);
            if (!isAngleInFOV(angleToCorner, facingAngle, FOV)) continue;

            // 2 rays per corner instead of 3 (drop center ray - edges define the polygon)
            const angA = angleToCorner - CORNER_RAY_OFFSET_DEGREES;
            const angB = angleToCorner + CORNER_RAY_OFFSET_DEGREES;
            const radA = angleToRadians(angA);
            const radB = angleToRadians(angB);

            castRay(centerX, centerY, Math.cos(radA), Math.sin(radA), filteredSegments, _hitA);
            castRay(centerX, centerY, Math.cos(radB), Math.sin(radB), filteredSegments, _hitB);

            if (rayCount + 2 > rayPathBuffer.length) {
                rayPathBuffer.push({ x: 0, y: 0, d: 0 }, { x: 0, y: 0, d: 0 });
            }

            rayPathBuffer[rayCount].x = _hitA.x;
            rayPathBuffer[rayCount].y = _hitA.y;
            rayPathBuffer[rayCount].d = normalizeAngle(angA - facingAngle);
            rayCount++;

            rayPathBuffer[rayCount].x = _hitB.x;
            rayPathBuffer[rayCount].y = _hitB.y;
            rayPathBuffer[rayCount].d = normalizeAngle(angB - facingAngle);
            rayCount++;

            if (SETTINGS.debug) {
                drawRay(centerX, centerY, _hitA.x, _hitA.y, `corner-${corner.x}-${corner.y}`, true, 'corner');
                drawRay(centerX, centerY, _hitB.x, _hitB.y, `corner-${corner.x}-${corner.y}`, true, 'corner');
            }
        }
    } 
    
    // Spray pattern: fixed-count rays swept across FOV using incremental rotation.
    // Rays are emitted in angular order so the sort below is skipped entirely.
    // This is a much cheaper alternative to corner rays when there are many corners or performance is poor, but less accurate polygon shape.
    else if (config.type === RaycastTypes.SPRAY) {
        const SPRAY_STEP = 1;
        const stepRad = angleToRadians(SPRAY_STEP);

        const cosStep = Math.cos(stepRad);
        const sinStep = Math.sin(stepRad);
        let dirX = Math.cos(angleToRadians(lowerLimit));
        let dirY = Math.sin(angleToRadians(lowerLimit));
        for (let angle = lowerLimit; angle < upperLimit; angle += SPRAY_STEP) {
            if (rayCount >= rayPathBuffer.length) {
                rayPathBuffer.push({ x: 0, y: 0, d: 0 });
            }

            castRay(centerX, centerY, dirX, dirY, filteredSegments, rayPathBuffer[rayCount]);
            rayPathBuffer[rayCount].d = normalizeAngle(angle - facingAngle);
            rayCount++;

            // Rotate direction vector by stepRad (2D rotation matrix)
            const nx = dirX * cosStep - dirY * sinStep;
            const ny = dirX * sinStep + dirY * cosStep;
            dirX = nx;
            dirY = ny;
        }
    }

    // Sort only needed for CORNERS (spray rays are already in angular order)
    if (config.type === RaycastTypes.CORNERS) {
        for (let i = 1; i < rayCount; i++) {
            const key = rayPathBuffer[i];
            const keyD = key.d;
            let j = i - 1;
            while (j >= 0 && rayPathBuffer[j].d > keyD) {
                rayPathBuffer[j + 1] = rayPathBuffer[j];
                j--;
            }
            rayPathBuffer[j + 1] = key;
        }
    }

    // Build polygon string directly (avoid intermediate array + map + join)
    const totalPoints = rayCount + 4; // center + lowerHit + rays + upperHit + center
    if (polyStringParts.length < totalPoints) {
        polyStringParts = new Array(totalPoints);
    }
    polyStringParts[0] = `${Math.round(centerX)}px ${Math.round(centerY)}px`;
    polyStringParts[1] = `${Math.round(_lowerHit.x)}px ${Math.round(_lowerHit.y)}px`;
    for (let i = 0; i < rayCount; i++) {
        polyStringParts[i + 2] = `${Math.round(rayPathBuffer[i].x)}px ${Math.round(rayPathBuffer[i].y)}px`;
    }
    polyStringParts[rayCount + 2] = `${Math.round(_upperHit.x)}px ${Math.round(_upperHit.y)}px`;
    polyStringParts[rayCount + 3] = `${Math.round(centerX)}px ${Math.round(centerY)}px`;

    const polygonPath = 'polygon(' + polyStringParts.slice(0, totalPoints).join(',') + ')';
    if (!_fogOfWarEl) _fogOfWarEl = document.getElementById('fog-of-war');
    if (_fogOfWarEl) {
        _fogOfWarEl.style.clipPath = polygonPath;
    }
}

let _fogOfWarEl: HTMLElement | null = null;

let fovLineLeft: HTMLElement | null = null;
let fovLineRight: HTMLElement | null = null;

function ensureFOVLineElements() {
    if (fovLineLeft) return;
    fovLineLeft = document.createElement('div');
    fovLineLeft.classList.add('fov-line');
    app.appendChild(fovLineLeft);

    fovLineRight = document.createElement('div');
    fovLineRight.classList.add('fov-line');
    app.appendChild(fovLineRight);
}

export function generateFOVCone(playerInfo: player_info) {
    ensureFOVLineElements();

    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;
    const facingAngle = playerInfo.current_position.rotation - 90;

    const lowerAngle = facingAngle - FOV;
    const upperAngle = facingAngle + FOV;
    const lowerRad = angleToRadians(lowerAngle);
    const upperRad = angleToRadians(upperAngle);
    const lDx = Math.cos(lowerRad);
    const lDy = Math.sin(lowerRad);
    const uDx = Math.cos(upperRad);
    const uDy = Math.sin(upperRad);

    const segments = environment.segments;
    let leftLen = 5000;
    let rightLen = 5000;
    for (let i = 0, len = segments.length; i < len; i++) {
        const seg = segments[i];
        const tl = raySegmentIntersect(cx, cy, lDx, lDy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (tl !== null && tl > 0 && tl < leftLen) leftLen = tl;
        const tr = raySegmentIntersect(cx, cy, uDx, uDy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (tr !== null && tr > 0 && tr < rightLen) rightLen = tr;
    }

    fovLineLeft!.style.display = 'block';
    fovLineLeft!.style.left = `${cx}px`;
    fovLineLeft!.style.top = `${cy}px`;
    fovLineLeft!.style.width = `${leftLen}px`;
    fovLineLeft!.style.transform = `rotate(${lowerAngle}deg)`;

    fovLineRight!.style.display = 'block';
    fovLineRight!.style.left = `${cx}px`;
    fovLineRight!.style.top = `${cy}px`;
    fovLineRight!.style.width = `${rightLen}px`;
    fovLineRight!.style.transform = `rotate(${upperAngle}deg)`;
}

export function hideFOVCone() {
    if (fovLineLeft) fovLineLeft.style.display = 'none';
    if (fovLineRight) fovLineRight.style.display = 'none';
}

// --- Adaptive quality: FPS monitor ---

const FPS_SAMPLE_WINDOW = 3000; // 3 seconds
const FPS_THRESHOLD = 30;
let fpsFrameTimes: number[] = [];
let adaptivePromptDismissed = false;
let adaptiveModalEl: HTMLElement | null = null;

export function tickAdaptiveQuality(timestamp: number) {
    if (adaptivePromptDismissed) return;
    if (SETTINGS.raycast.type !== 'MAIN_THREAD') return;

    fpsFrameTimes.push(timestamp);

    // Only keep last FPS_SAMPLE_WINDOW ms of frame times
    const cutoff = timestamp - FPS_SAMPLE_WINDOW;
    while (fpsFrameTimes.length > 0 && fpsFrameTimes[0] < cutoff) {
        fpsFrameTimes.shift();
    }

    // Need at least 2 seconds of data before judging
    if (fpsFrameTimes.length < 2) return;
    const elapsed = fpsFrameTimes[fpsFrameTimes.length - 1] - fpsFrameTimes[0];
    if (elapsed < FPS_SAMPLE_WINDOW * 0.9) return;

    const avgFps = (fpsFrameTimes.length - 1) / (elapsed / 1000);
    if (avgFps < FPS_THRESHOLD) {
        showAdaptiveQualityModal();
    }
}

function showAdaptiveQualityModal() {
    if (adaptiveModalEl) return;
    adaptivePromptDismissed = true; // only prompt once per session

    adaptiveModalEl = document.createElement('div');
    adaptiveModalEl.id = 'adaptive-quality-modal';
    adaptiveModalEl.innerHTML = `
        <div class="aq-title">PERFORMANCE ISSUES DETECTED</div>
        <div class="aq-body">Switch to fast raycasting for better performance?</div>
        <div class="aq-buttons">
            <button id="aq-accept">ACCEPT</button>
            <button id="aq-dismiss">DISMISS</button>
        </div>
    `;
    document.body.appendChild(adaptiveModalEl);

    document.getElementById('aq-accept')!.addEventListener('click', () => {
        SETTINGS.raycast.type = 'DISABLED';
        const fogOfWar = document.getElementById('fog-of-war');
        if (fogOfWar) fogOfWar.classList.remove('d-none');
        removeAdaptiveModal();
        const dropdown = document.getElementById('opt-raycast') as HTMLSelectElement | null;
        if (dropdown) dropdown.value = 'DISABLED';
    });

    document.getElementById('aq-dismiss')!.addEventListener('click', () => {
        removeAdaptiveModal();
    });
}

function removeAdaptiveModal() {
    if (adaptiveModalEl) {
        adaptiveModalEl.remove();
        adaptiveModalEl = null;
    }
}

function drawRay(sx: number, sy: number, tx: number, ty: number, identifier: string, visible: boolean, type?: string) {
    const angleToTarget = getAngle(sx, sy, tx, ty);
    const distance = getDistance(sx, sy, tx, ty);

    const el = document.createElement('div');
    el.id = `ray-${identifier}`;
    el.setAttribute('data-visible', `${visible}`);
    el.classList.add('ray');
    if (type !== undefined) el.classList.add(type);
    el.style.width = `${distance}px`;
    el.style.transform = `translate3d(${sx}px, ${sy}px, 0) rotate(${angleToTarget}deg)`;
    app.appendChild(el);
}
