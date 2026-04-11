import { environment } from '@simulation/environment/environment';
import { raySegmentIntersect } from '@simulation/detection/rayGeometry';

const DEG_TO_RAD = Math.PI / 180;
const CORNER_OFFSET = 0.01; // degrees, same as CORNER_RAY_OFFSET_DEGREES
const AABB_PAD = 50;

// Pre-allocated buffers to avoid GC pressure
const _hit: coordinates = { x: 0, y: 0 };

interface RayEntry {
    x: number;
    y: number;
    angle: number;
}

const rayBuffer: RayEntry[] = [];

function castRay(ox: number, oy: number, dx: number, dy: number, maxDist: number, segments: WallSegment[]): void {
    let nearest = maxDist;
    for (let i = 0, len = segments.length; i < len; i++) {
        const seg = segments[i];
        const t = raySegmentIntersect(ox, oy, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t < nearest) nearest = t;
    }
    _hit.x = ox + dx * nearest;
    _hit.y = oy + dy * nearest;
}

// Reusable arrays to avoid allocations per call
const _filteredSegs: WallSegment[] = [];
const _corners: { x: number; y: number }[] = [];

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

function collectCorners(cx: number, cy: number, radiusSq: number): typeof _corners {
    _corners.length = 0;
    const corners = environment.corners;
    for (let i = 0, len = corners.length; i < len; i++) {
        const c = corners[i];
        const dx = c.x - cx;
        const dy = c.y - cy;
        if (dx * dx + dy * dy <= radiusSq) {
            // Deduplicate by exact coordinate
            let dup = false;
            for (let j = 0, jlen = _corners.length; j < jlen; j++) {
                if (_corners[j].x === c.x && _corners[j].y === c.y) { dup = true; break; }
            }
            if (!dup) _corners.push(c);
        }
    }
    return _corners;
}

export function computeLightPolygon(cx: number, cy: number, radius: number): number[] | null {
    const segments = filterSegmentsByAABB(cx, cy, radius);
    if (segments.length === 0) return null;

    const radiusSq = radius * radius;
    const corners = collectCorners(cx, cy, radiusSq);

    let rayCount = 0;

    for (let i = 0, len = corners.length; i < len; i++) {
        const corner = corners[i];
        const angleToCorner = Math.atan2(corner.y - cy, corner.x - cx) * (180 / Math.PI);

        const angA = angleToCorner - CORNER_OFFSET;
        const angB = angleToCorner + CORNER_OFFSET;
        const radA = angA * DEG_TO_RAD;
        const radB = angB * DEG_TO_RAD;

        castRay(cx, cy, Math.cos(radA), Math.sin(radA), radius, segments);
        if (rayCount + 2 > rayBuffer.length) {
            rayBuffer.push({ x: 0, y: 0, angle: 0 }, { x: 0, y: 0, angle: 0 });
        }
        rayBuffer[rayCount].x = _hit.x;
        rayBuffer[rayCount].y = _hit.y;
        rayBuffer[rayCount].angle = angA;
        rayCount++;

        castRay(cx, cy, Math.cos(radB), Math.sin(radB), radius, segments);
        rayBuffer[rayCount].x = _hit.x;
        rayBuffer[rayCount].y = _hit.y;
        rayBuffer[rayCount].angle = angB;
        rayCount++;
    }

    if (rayCount === 0) return null;

    // Sort by angle for correct polygon winding
    const slice = rayBuffer.slice(0, rayCount);
    slice.sort((a, b) => a.angle - b.angle);

    const pts: number[] = [];
    for (let i = 0; i < rayCount; i++) {
        pts.push(slice[i].x, slice[i].y);
    }

    return pts;
}
