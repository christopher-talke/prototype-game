import { environment } from '../../Environment/environment';
import { app, SETTINGS } from '../../main';
import { getAngle } from '../../Utilities/getAngle';
import { getDistance } from '../../Utilities/getDistance';
import { HALF_HIT_BOX, FOV, CORNER_RAY_OFFSET_DEGREES } from '../../constants';
import { isSmoked } from '../../Combat/smoke';

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

function angleToRadians(deg: number): number {
    return (Math.PI / 180) * deg;
}

/**
 * Returns the t value where a ray hits a line segment, or null if no hit.
 * Ray: origin + t * dir, t >= 0
 * Segment: p1 + u * (p2 - p1), 0 <= u <= 1
 */
export function raySegmentIntersect(ox: number, oy: number, dx: number, dy: number, x1: number, y1: number, x2: number, y2: number): number | null {
    const sx = x2 - x1;
    const sy = y2 - y1;

    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-10) return null; // Parallel

    const t = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
    const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;

    if (t >= 0 && u >= 0 && u <= 1) {
        return t;
    }
    return null;
}

/**
 * Cast a single ray from origin at given angle, test against all wall segments.
 * Returns the nearest intersection point.
 */
function castRay(originX: number, originY: number, angleDeg: number, segments: WallSegment[]): coordinates {
    const rad = angleToRadians(angleDeg);
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);

    let nearestT = Infinity;

    for (const seg of segments) {
        const t = raySegmentIntersect(originX, originY, dirX, dirY, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t < nearestT) {
            nearestT = t;
        }
    }

    if (nearestT === Infinity) {
        nearestT = 5000;
    }

    return {
        x: originX + dirX * nearestT,
        y: originY + dirY * nearestT,
    };
}

/**
 * Check if a single ray from (sx,sy) toward (tx,ty) is blocked.
 */
function isSingleRayBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-10) return false;
    const ndx = dx / dist;
    const ndy = dy / dist;
    for (const seg of segments) {
        const t = raySegmentIntersect(sx, sy, ndx, ndy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t > 0.5 && t < dist - 0.5) return true;
    }
    return false;
}

/**
 * Checks if a line between two points is blocked by any wall segment.
 * Tests center + 3 offset points on the target so players near walls remain visible.
 * @param sx The starting X coordinate.
 * @param sy The starting Y coordinate.
 * @param tx The target X coordinate.
 * @param ty The target Y coordinate.
 * @param segments The array of wall segments to check against.
 * @returns True if the line is blocked, false otherwise.
 */
export function isLineBlocked(sx: number, sy: number, tx: number, ty: number, segments: WallSegment[]): boolean {
    // Smoke blocks line of sight
    if (isSmoked(sx, sy, tx, ty)) return true;

    // Perpendicular offset to check points slightly to each side of target center
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-10) return false;
    const OFFSET = 10;
    const px = (-dy / dist) * OFFSET;
    const py = (dx / dist) * OFFSET;

    // Visible if ANY of the sample points is unblocked
    if (!isSingleRayBlocked(sx, sy, tx, ty, segments)) return false;
    if (!isSingleRayBlocked(sx, sy, tx + px, ty + py, segments)) return false;
    if (!isSingleRayBlocked(sx, sy, tx - px, ty - py, segments)) return false;
    return true;
}

/**
 * Generates a raycast from the player's position based on the provided configuration.
 * @param playerInfo The player's information including position and rotation.
 * @param config The raycast configuration specifying the type of raycast.
 * @returns void
 */
export function generateRayCast(playerInfo: player_info, config: raycast_config) {
    if (SETTINGS.debug) {
        for (const el of Array.from(document.querySelectorAll('.ray'))) el.remove();
    }

    const centerX = playerInfo.current_position.x + HALF_HIT_BOX;
    const centerY = playerInfo.current_position.y + HALF_HIT_BOX;

    const facingAngle = playerInfo.current_position.rotation - 90;
    const lowerLimit = facingAngle - FOV;
    const upperLimit = facingAngle + FOV;

    const segments = environment.segments;

    // Boundary rays
    const lowerHit = castRay(centerX, centerY, lowerLimit, segments);
    const upperHit = castRay(centerX, centerY, upperLimit, segments);

    const raycastPath: RayPoint[] = [];

    if (config.type === 'CORNERS') {
        for (const corner of environment.corners) {
            const angleToCorner = getAngle(centerX, centerY, corner.x, corner.y);
            const visible = isAngleInFOV(angleToCorner, facingAngle, FOV);

            if (visible) {
                // Cast rays at corner angle +/- offset to capture shadow edges
                const hitUp = castRay(centerX, centerY, angleToCorner - CORNER_RAY_OFFSET_DEGREES, segments);
                const hitDown = castRay(centerX, centerY, angleToCorner + CORNER_RAY_OFFSET_DEGREES, segments);
                const hitCenter = castRay(centerX, centerY, angleToCorner, segments);

                raycastPath.push({ x: hitUp.x, y: hitUp.y, d: normalizeAngle(angleToCorner - CORNER_RAY_OFFSET_DEGREES - facingAngle) }, { x: hitCenter.x, y: hitCenter.y, d: normalizeAngle(angleToCorner - facingAngle) }, { x: hitDown.x, y: hitDown.y, d: normalizeAngle(angleToCorner + CORNER_RAY_OFFSET_DEGREES - facingAngle) });

                if (SETTINGS.debug) {
                    drawRay(centerX, centerY, hitCenter.x, hitCenter.y, `corner-${corner.x}-${corner.y}`, visible, 'corner');
                }
            }
        }
    } else if (config.type === 'SPRAY') {
        for (let i = lowerLimit; i < upperLimit; i += 10) {
            const hit = castRay(centerX, centerY, i, segments);
            raycastPath.push({ x: hit.x, y: hit.y, d: normalizeAngle(i - facingAngle) });
        }
    }

    // Sort by angle relative to facing direction
    raycastPath.sort((a, b) => a.d - b.d);

    // Assemble full polygon path
    const fullPath: coordinates[] = [{ x: centerX, y: centerY }, { x: lowerHit.x, y: lowerHit.y }, ...raycastPath, { x: upperHit.x, y: upperHit.y }, { x: centerX, y: centerY }];

    const polygonPath = 'polygon(' + fullPath.map((p) => `${Math.round(p.x)}px ${Math.round(p.y)}px`).join(',') + ')';

    const fogOfWar = document.getElementById('fog-of-war');
    if (fogOfWar) {
        fogOfWar.style.clipPath = polygonPath;
    }

    return;
}

/**
 * Draws a debug ray from the start coordinates to the target coordinates.
 * @param sx The starting X coordinate.
 * @param sy The starting Y coordinate.
 * @param tx The target X coordinate.
 * @param ty The target Y coordinate.
 * @param identifier A unique identifier for the ray.
 * @param visible Whether the ray is currently visible.
 * @param type The type of the ray (optional).
 */
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
