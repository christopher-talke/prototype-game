import { environment } from '@simulation/environment/environment';
import { raySegmentIntersect } from '@simulation/detection/rayGeometry';

const DEG_TO_RAD = Math.PI / 180;
const CORNER_OFFSET = 0.01; // degrees
const AABB_PAD = 50;
const BOUNDARY_STEP = 10; // degrees between boundary rays
const FULL_CIRCLE = 360;

// Pre-allocated hit point
const _hit = { x: 0, y: 0 };

interface RayHit {
    x: number;
    y: number;
    angle: number; // radians for sorting
}

let rayBuffer: RayHit[] = [];

function ensureBuffer(needed: number) {
    while (rayBuffer.length < needed) {
        rayBuffer.push({ x: 0, y: 0, angle: 0 });
    }
}

// Reusable filtered segment array
const _filteredSegs: WallSegment[] = [];

function filterSegmentsByAABB(cx: number, cy: number, radius: number): WallSegment[] {
    const minX = cx - radius - AABB_PAD;
    const maxX = cx + radius + AABB_PAD;
    const minY = cy - radius - AABB_PAD;
    const maxY = cy + radius + AABB_PAD;

    _filteredSegs.length = 0;
    const segs = environment.segments;
    for (let i = 0, len = segs.length; i < len; i++) {
        const seg = segs[i];
        const segMinX = seg.x1 < seg.x2 ? seg.x1 : seg.x2;
        const segMaxX = seg.x1 > seg.x2 ? seg.x1 : seg.x2;
        const segMinY = seg.y1 < seg.y2 ? seg.y1 : seg.y2;
        const segMaxY = seg.y1 > seg.y2 ? seg.y1 : seg.y2;

        if (segMaxX >= minX && segMinX <= maxX && segMaxY >= minY && segMinY <= maxY) {
            _filteredSegs.push(seg);
        }
    }
    return _filteredSegs;
}

function castRay(ox: number, oy: number, dx: number, dy: number, maxDist: number, segments: WallSegment[]): void {
    let nearest = maxDist;
    for (let i = 0, len = segments.length; i < len; i++) {
        const seg = segments[i];
        const t = raySegmentIntersect(ox, oy, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t > 0 && t < nearest) nearest = t;
    }
    _hit.x = ox + dx * nearest;
    _hit.y = oy + dy * nearest;
}

export function computeLightPolygon(cx: number, cy: number, radius: number): number[] | null {
    const segments = filterSegmentsByAABB(cx, cy, radius);
    if (segments.length === 0) return null;

    const radiusSq = radius * radius;
    let rayCount = 0;

    // 1) Boundary rays at fixed intervals for full 360 coverage
    const boundaryRays = Math.ceil(FULL_CIRCLE / BOUNDARY_STEP);
    ensureBuffer(boundaryRays + environment.corners.length * 2);

    for (let i = 0; i < boundaryRays; i++) {
        const angleDeg = i * BOUNDARY_STEP;
        const angleRad = angleDeg * DEG_TO_RAD;
        castRay(cx, cy, Math.cos(angleRad), Math.sin(angleRad), radius, segments);
        rayBuffer[rayCount].x = _hit.x;
        rayBuffer[rayCount].y = _hit.y;
        rayBuffer[rayCount].angle = angleRad;
        rayCount++;
    }

    // 2) Corner rays for sharp shadow edges
    const corners = environment.corners;
    for (let i = 0, len = corners.length; i < len; i++) {
        const c = corners[i];
        const dx = c.x - cx;
        const dy = c.y - cy;
        if (dx * dx + dy * dy > radiusSq) continue;

        const angleToCorner = Math.atan2(dy, dx);
        const offsetRad = CORNER_OFFSET * DEG_TO_RAD;

        const angA = angleToCorner - offsetRad;
        const angB = angleToCorner + offsetRad;

        ensureBuffer(rayCount + 2);

        castRay(cx, cy, Math.cos(angA), Math.sin(angA), radius, segments);
        rayBuffer[rayCount].x = _hit.x;
        rayBuffer[rayCount].y = _hit.y;
        rayBuffer[rayCount].angle = angA;
        rayCount++;

        castRay(cx, cy, Math.cos(angB), Math.sin(angB), radius, segments);
        rayBuffer[rayCount].x = _hit.x;
        rayBuffer[rayCount].y = _hit.y;
        rayBuffer[rayCount].angle = angB;
        rayCount++;
    }

    if (rayCount === 0) return null;

    // 3) Sort all rays by angle
    const slice = rayBuffer.slice(0, rayCount);
    slice.sort((a, b) => a.angle - b.angle);

    // 4) Build fan polygon: center -> sorted hits -> close to center
    const pts: number[] = [cx, cy];
    for (let i = 0; i < rayCount; i++) {
        pts.push(slice[i].x, slice[i].y);
    }
    // Close the fan back to the first hit point (not center -- Graphics.poly closes automatically)

    return pts;
}
