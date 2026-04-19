import { describe, it, expect } from 'vitest';

import type { Vec2 } from '@shared/map/MapData';
import {
    closestPointOnSegment,
    distanceToSegmentSq,
    pickEdge,
    pickVertex,
} from '../polygonHitTest';

describe('closestPointOnSegment', () => {
    it('returns the perpendicular foot when it lies inside the segment', () => {
        const c = closestPointOnSegment(5, 10, 0, 0, 10, 0);
        expect(c.x).toBe(5);
        expect(c.y).toBe(0);
        expect(c.t).toBe(0.5);
    });

    it('clamps to endpoint a when the foot is before the segment', () => {
        const c = closestPointOnSegment(-5, 0, 0, 0, 10, 0);
        expect(c.x).toBe(0);
        expect(c.y).toBe(0);
        expect(c.t).toBe(0);
    });

    it('clamps to endpoint b when the foot is past the segment', () => {
        const c = closestPointOnSegment(20, 5, 0, 0, 10, 0);
        expect(c.x).toBe(10);
        expect(c.y).toBe(0);
        expect(c.t).toBe(1);
    });

    it('handles a degenerate zero-length segment by returning a', () => {
        const c = closestPointOnSegment(5, 5, 3, 3, 3, 3);
        expect(c.x).toBe(3);
        expect(c.y).toBe(3);
        expect(c.t).toBe(0);
    });
});

describe('distanceToSegmentSq', () => {
    it('returns squared perpendicular distance for interior foot', () => {
        expect(distanceToSegmentSq(5, 4, 0, 0, 10, 0)).toBe(16);
    });

    it('returns squared distance to endpoint when foot is outside', () => {
        expect(distanceToSegmentSq(-3, 4, 0, 0, 10, 0)).toBe(9 + 16);
    });
});

describe('pickVertex', () => {
    const verts: Vec2[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
    ];

    it('returns the nearest vertex within radius', () => {
        expect(pickVertex(verts, 1, 0, 2)).toBe(0);
        expect(pickVertex(verts, 9, 10, 2)).toBe(2);
    });

    it('returns null when no vertex is within radius', () => {
        expect(pickVertex(verts, 5, 5, 2)).toBe(null);
    });

    it('prefers the earlier index on a tie', () => {
        // Equidistant from v0 and v1.
        expect(pickVertex([{ x: 0, y: 0 }, { x: 10, y: 0 }], 5, 5, 100)).toBe(0);
    });
});

describe('pickEdge', () => {
    const verts: Vec2[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
    ];

    it('finds the top edge from a point just above it', () => {
        const hit = pickEdge(verts, 5, -1, 2);
        expect(hit).not.toBe(null);
        expect(hit!.index).toBe(0);
        expect(hit!.t).toBeCloseTo(0.5, 5);
        expect(hit!.x).toBeCloseTo(5, 5);
        expect(hit!.y).toBe(0);
    });

    it('wraps to the closing edge when the pointer is near the last->first segment', () => {
        const hit = pickEdge(verts, -1, 5, 2);
        expect(hit).not.toBe(null);
        expect(hit!.index).toBe(3); // edge from v3 -> v0
        expect(hit!.t).toBeCloseTo(0.5, 5);
    });

    it('returns null when no edge is within radius', () => {
        expect(pickEdge(verts, 50, 50, 2)).toBe(null);
    });

    it('returns null for degenerate vertex lists (< 2 vertices)', () => {
        expect(pickEdge([{ x: 0, y: 0 }], 0, 0, 2)).toBe(null);
        expect(pickEdge([], 0, 0, 2)).toBe(null);
    });
});
