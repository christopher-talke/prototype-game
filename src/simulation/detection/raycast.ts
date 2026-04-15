import { environment } from '@simulation/environment/environment';
import { getAngle } from '@utils/getAngle';
import { HALF_HIT_BOX, FOV, CORNER_RAY_OFFSET_DEGREES } from '../../constants';
import { isSmoked } from '@simulation/combat/smokeData';
import { raySegmentIntersect, isLineBlocked as _geoLineBlocked } from '@simulation/detection/rayGeometry';
import { normalizeAngle } from '@utils/normalizeAngle';

/** Raycast strategy used by `computeRaycastPolygon`. */
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

/**
 * Returns true if the straight line between two world points is blocked by
 * smoke or wall geometry.
 *
 * Delegates smoke check to `isSmoked`, then wall check to `rayGeometry`.
 *
 * @param sx - Start x.
 * @param sy - Start y.
 * @param tx - Target x.
 * @param ty - Target y.
 * @param segments - Wall segments to test against.
 */
export function isLineBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    if (isSmoked(sx, sy, tx, ty)) return true;
    return _geoLineBlocked(sx, sy, tx, ty, segments);
}

// Frame-skip state - avoids re-casting when the player has barely moved.
let lastCastX = NaN;
let lastCastY = NaN;
let lastCastRot = NaN;
const POSITION_THRESHOLD = 0.5;
const ROTATION_THRESHOLD = 0.5;

// Pre-allocated reusable buffers
const rayPathBuffer: RayPoint[] = [];
const vertexBuffer: coordinates[] = [];

const _filteredSegments: WallSegment[] = [];

/**
 * Filters `segments` to those whose AABB overlaps the bounding box of the
 * player's FOV cone, eliminating wall segments that cannot possibly contribute
 * to the raycast polygon.
 *
 * The bounding box is derived from the two FOV boundary rays extended to
 * `maxDist`, plus a small padding to catch segments that straddle the edge.
 *
 * @param cx - Observer x.
 * @param cy - Observer y.
 * @param lowerRad - Lower FOV boundary angle in radians.
 * @param upperRad - Upper FOV boundary angle in radians.
 * @param maxDist - Maximum ray length in world units.
 * @param segments - Full wall segment list to filter.
 * @returns Module-scoped buffer containing only the relevant segments (reused each call).
 */
function filterSegmentsByFOV(cx: number, cy: number, lowerRad: number, upperRad: number, maxDist: number, segments: WallSegment[]): WallSegment[] {
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

/**
 * Casts a single ray from `(originX, originY)` in direction `(dirX, dirY)`
 * and writes the nearest wall-hit point into `outPoint`. Falls back to 5000
 * units when no segment is hit.
 *
 * @param originX - Ray origin x.
 * @param originY - Ray origin y.
 * @param dirX - Normalised ray direction x.
 * @param dirY - Normalised ray direction y.
 * @param segments - Candidate wall segments (pre-filtered).
 * @param outPoint - Mutated in place with the hit coordinates.
 */
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

// Module-scope hit-point objects reused across raycast calls to avoid GC pressure.
const _lowerHit: coordinates = { x: 0, y: 0 };
const _upperHit: coordinates = { x: 0, y: 0 };
const _hitA: coordinates = { x: 0, y: 0 };
const _hitB: coordinates = { x: 0, y: 0 };

// Corners beyond this distance cannot meaningfully contribute to the polygon.
const MAX_CORNER_DIST_SQ = 1500 * 1500;

/**
 * Builds the 2D visibility polygon for a player using either corner-based or
 * spray raycasting. Returns `null` when the player has not moved enough since
 * the last call to warrant re-computing (frame-skip optimisation).
 *
 * Corner mode: casts a pair of offset rays around each wall corner inside the
 * FOV, then insertion-sorts them by angle for correct winding.
 *
 * Spray mode: casts rays at a fixed 1-degree interval across the FOV arc; less
 * accurate but cheaper when the map has many corners.
 *
 * @param playerInfo - Current player state (position + rotation).
 * @param config - Raycast strategy selector (`CORNERS` or `SPRAY`).
 * @returns Reused vertex buffer and point count, or `null` to signal skip.
 */
export function computeRaycastPolygon(playerInfo: player_info, config: raycast_config): { vertices: coordinates[]; count: number } | null {
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

    // Shoot the two boundary rays to anchor the polygon edges.
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
    }

    // Spray mode: fixed-interval rays, no sorting required.
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

            const nx = dirX * cosStep - dirY * sinStep;
            const ny = dirX * sinStep + dirY * cosStep;
            dirX = nx;
            dirY = ny;
        }
    }

    // Insertion sort corner rays by relative angle for correct polygon winding.
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

    // Assemble vertex buffer: center, lowerHit, sorted interior hits, upperHit, center.
    const totalPoints = rayCount + 4;
    while (vertexBuffer.length < totalPoints) vertexBuffer.push({ x: 0, y: 0 });
    vertexBuffer[0].x = centerX;          vertexBuffer[0].y = centerY;
    vertexBuffer[1].x = _lowerHit.x;      vertexBuffer[1].y = _lowerHit.y;
    for (let i = 0; i < rayCount; i++) {
        vertexBuffer[i + 2].x = rayPathBuffer[i].x;
        vertexBuffer[i + 2].y = rayPathBuffer[i].y;
    }
    vertexBuffer[rayCount + 2].x = _upperHit.x;  vertexBuffer[rayCount + 2].y = _upperHit.y;
    vertexBuffer[rayCount + 3].x = centerX;       vertexBuffer[rayCount + 3].y = centerY;

    return { vertices: vertexBuffer, count: totalPoints };
}

/**
 * Computes the two FOV boundary ray lengths by casting against all wall
 * segments, returning the data needed to draw a simple cone when full raycast
 * polygon rendering is unavailable.
 *
 * @param playerInfo - Current player state.
 * @returns Center position, lower/upper FOV angles (degrees), and the
 *          distance to the nearest wall hit along each boundary ray.
 */
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
