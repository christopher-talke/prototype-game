import { environment } from '@simulation/environment/environment';
import { getAngle } from '../../utils/getAngle';
import { HALF_HIT_BOX, FOV, CORNER_RAY_OFFSET_DEGREES } from '../../constants';
import { isSmoked } from '@simulation/combat/smokeData';
import { raySegmentIntersect, isLineBlocked as _geoLineBlocked } from './rayGeometry';
import { normalizeAngle } from '@utils/normalizeAngle';

export enum RaycastTypes {
    SPRAY = 'SPRAY',
    CORNERS = 'CORNERS',
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

export function isLineBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    if (isSmoked(sx, sy, tx, ty)) return true;
    return _geoLineBlocked(sx, sy, tx, ty, segments);
}

// Frame skipping state
let lastCastX = NaN;
let lastCastY = NaN;
let lastCastRot = NaN;
const POSITION_THRESHOLD = 0.5;
const ROTATION_THRESHOLD = 0.5;

// Pre-allocated reusable buffers
const rayPathBuffer: RayPoint[] = [];
let polyStringParts: string[] = [];

const _filteredSegments: WallSegment[] = [];

function filterSegmentsByFOV(
    cx: number, cy: number,
    lowerRad: number, upperRad: number,
    maxDist: number,
    segments: WallSegment[],
): WallSegment[] {
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

const _lowerHit: coordinates = { x: 0, y: 0 };
const _upperHit: coordinates = { x: 0, y: 0 };
const _hitA: coordinates = { x: 0, y: 0 };
const _hitB: coordinates = { x: 0, y: 0 };
const MAX_CORNER_DIST_SQ = 1500 * 1500;

// Returns a CSS polygon() path string, or null if frame can be skipped.
export function computeRaycastPolygon(playerInfo: player_info, config: raycast_config): string | null {
    const centerX = playerInfo.current_position.x + HALF_HIT_BOX;
    const centerY = playerInfo.current_position.y + HALF_HIT_BOX;
    const rotation = playerInfo.current_position.rotation;

    const dx = centerX - lastCastX;
    const dy = centerY - lastCastY;
    const dr = Math.abs(normalizeAngle(rotation - lastCastRot));
    if (dx * dx + dy * dy < POSITION_THRESHOLD * POSITION_THRESHOLD && dr < ROTATION_THRESHOLD) return null;

    lastCastX = centerX;
    lastCastY = centerY;
    lastCastRot = rotation;

    const facingAngle = rotation - 90;
    const lowerLimit = facingAngle - FOV;
    const upperLimit = facingAngle + FOV;

    const lowerRad = angleToRadians(lowerLimit);
    const upperRad = angleToRadians(upperLimit);

    const filteredSegments = filterSegmentsByFOV(centerX, centerY, lowerRad, upperRad, 5000, environment.segments);

    const lowerDirX = Math.cos(lowerRad);
    const lowerDirY = Math.sin(lowerRad);
    const upperDirX = Math.cos(upperRad);
    const upperDirY = Math.sin(upperRad);

    castRay(centerX, centerY, lowerDirX, lowerDirY, filteredSegments, _lowerHit);
    castRay(centerX, centerY, upperDirX, upperDirY, filteredSegments, _upperHit);

    let rayCount = 0;

    if (config.type === 'CORNERS') {
        const corners = environment.corners;
        for (let ci = 0, clen = corners.length; ci < clen; ci++) {
            const corner = corners[ci];

            const cdx = corner.x - centerX;
            const cdy = corner.y - centerY;
            if (cdx * cdx + cdy * cdy > MAX_CORNER_DIST_SQ) continue;

            const angleToCorner = getAngle(centerX, centerY, corner.x, corner.y);
            if (!isAngleInFOV(angleToCorner, facingAngle, FOV)) continue;

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
        }
    } else if (config.type === RaycastTypes.SPRAY) {
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

            const nx = dirX * cosStep - dirY * sinStep;
            const ny = dirX * sinStep + dirY * cosStep;
            dirX = nx;
            dirY = ny;
        }
    }

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

    const totalPoints = rayCount + 4;
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

    return 'polygon(' + polyStringParts.slice(0, totalPoints).join(',') + ')';
}

// FOV cone boundary ray computation (pure - returns lengths for rendering)
export function computeFOVCone(playerInfo: player_info): { cx: number; cy: number; lowerAngle: number; upperAngle: number; leftLen: number; rightLen: number } {
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

    return { cx, cy, lowerAngle, upperAngle, leftLen, rightLen };
}
