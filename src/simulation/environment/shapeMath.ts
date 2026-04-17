/**
 * Shape hit-test and AABB helpers for `CollisionShape` at runtime. Used by
 * the dynamic entity collision query (simulation layer). The point-in-shape
 * test inverse-rotates the probe into the entity's local frame so we don't
 * materialise a transformed shape per query.
 */

import type { CollisionShape, Vec2 } from '@shared/map/MapData';
import type { AABB } from './spatialHash';

/**
 * World-space AABB for a collision shape anchored at `position` with
 * `rotation` (radians). No scale applied (runtime entities don't support
 * non-uniform scaling in Phase 2c).
 */
export function shapeWorldAABB(shape: CollisionShape, position: Vec2, rotation: number): AABB {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    switch (shape.type) {
        case 'aabb': {
            const corners: Vec2[] = [
                { x: shape.x, y: shape.y },
                { x: shape.x + shape.width, y: shape.y },
                { x: shape.x + shape.width, y: shape.y + shape.height },
                { x: shape.x, y: shape.y + shape.height },
            ];
            return boundsOfRotated(corners, cos, sin, position);
        }
        case 'polygon':
            return boundsOfRotated(shape.vertices, cos, sin, position);
        case 'circle': {
            const cx = shape.center.x * cos - shape.center.y * sin + position.x;
            const cy = shape.center.x * sin + shape.center.y * cos + position.y;
            return { x: cx - shape.radius, y: cy - shape.radius, w: shape.radius * 2, h: shape.radius * 2 };
        }
    }
}

function boundsOfRotated(points: readonly Vec2[], cos: number, sin: number, origin: Vec2): AABB {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        const x = p.x * cos - p.y * sin + origin.x;
        const y = p.x * sin + p.y * cos + origin.y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Tests whether world-space `point` is inside `shape` at the given `position`/`rotation`. */
export function pointInsideShape(
    shape: CollisionShape,
    position: Vec2,
    rotation: number,
    point: Vec2,
): boolean {
    const dx = point.x - position.x;
    const dy = point.y - position.y;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    switch (shape.type) {
        case 'aabb':
            return lx >= shape.x && lx <= shape.x + shape.width && ly >= shape.y && ly <= shape.y + shape.height;
        case 'polygon':
            return pointInPolygon(shape.vertices, lx, ly);
        case 'circle': {
            const ex = lx - shape.center.x;
            const ey = ly - shape.center.y;
            return ex * ex + ey * ey <= shape.radius * shape.radius;
        }
    }
}

function pointInPolygon(vs: readonly Vec2[], x: number, y: number): boolean {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x;
        const yi = vs[i].y;
        const xj = vs[j].x;
        const yj = vs[j].y;
        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}
