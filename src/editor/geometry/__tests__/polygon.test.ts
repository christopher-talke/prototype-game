import { describe, it, expect } from 'vitest';

import {
    enforceCW,
    isConvexCW,
    rectangleVertices,
    rotatedRectangleVertices,
    signedArea,
    signedPerpendicularDistance,
} from '../polygon';

describe('signedPerpendicularDistance', () => {
    it('is positive on the (-dy, dx) side of a horizontal axis', () => {
        // a=(0,0) b=(10,0): dy=0, dx=10 -> n=(0,1), so +y is positive side
        expect(signedPerpendicularDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5, 10);
    });

    it('is negative on the opposite side', () => {
        expect(signedPerpendicularDistance({ x: 5, y: -5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(-5, 10);
    });

    it('is zero for a point on the axis', () => {
        expect(signedPerpendicularDistance({ x: 3, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    });

    it('is invariant to the test point projection along the axis', () => {
        // All three test points have the same perpendicular distance (5) from the x-axis.
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        expect(signedPerpendicularDistance({ x: 0, y: 5 }, a, b)).toBeCloseTo(5, 10);
        expect(signedPerpendicularDistance({ x: 5, y: 5 }, a, b)).toBeCloseTo(5, 10);
        expect(signedPerpendicularDistance({ x: 99, y: 5 }, a, b)).toBeCloseTo(5, 10);
    });

    it('uses (-dy, dx) normal for a vertical axis', () => {
        // a=(0,0) b=(0,10): n=(-1, 0), so +x is negative, -x is positive.
        expect(signedPerpendicularDistance({ x: -5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(5, 10);
        expect(signedPerpendicularDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(-5, 10);
    });

    it('returns 0 for a zero-length axis', () => {
        expect(signedPerpendicularDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    });
});

describe('rotatedRectangleVertices', () => {
    it('returns four vertices', () => {
        const v = rotatedRectangleVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 5);
        expect(v).toHaveLength(4);
    });

    it('produces CW winding for a positive height (signedArea <= 0 in Y-down)', () => {
        const v = rotatedRectangleVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 5);
        expect(signedArea(v)).toBeLessThanOrEqual(0);
        expect(isConvexCW(v).convex).toBe(true);
    });

    it('produces CW winding for a negative height (enforceCW reverses if needed)', () => {
        const v = rotatedRectangleVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, -5);
        expect(signedArea(v)).toBeLessThanOrEqual(0);
        expect(isConvexCW(v).convex).toBe(true);
    });

    it('axis-aligned case with positive height matches the axis-aligned rectangle', () => {
        // a=(0,0), b=(10,0), h=5 -> rectangle x in [0,10], y in [0,5]
        const rot = rotatedRectangleVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 5);
        const rect = rectangleVertices({ x: 0, y: 0 }, { x: 10, y: 5 });
        // Both are CW, 4-vertex axis-aligned boxes spanning the same region.
        // Compare as sets of points (insensitive to starting index).
        const norm = (pts: { x: number; y: number }[]) =>
            pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
        expect(norm(rot)).toEqual(norm(rect));
    });

    it('45-degree axis produces rotated rectangle with correct corner positions', () => {
        // a=(0,0), b=(10,10), h=5. Axis direction = (1,1)/sqrt(2); normal = (-1,1)/sqrt(2).
        // Vertex 3 (pre-CW) = b + n*h = (10 - 5/sqrt(2), 10 + 5/sqrt(2)).
        // Vertex 4 (pre-CW) = a + n*h = (-5/sqrt(2), 5/sqrt(2)).
        // Positive h in this construction stays CW so enforceCW is a no-op; the
        // returned order matches the original [a, b, b+n*h, a+n*h].
        const v = rotatedRectangleVertices({ x: 0, y: 0 }, { x: 10, y: 10 }, 5);
        const half = 5 / Math.sqrt(2);
        expect(v[0].x).toBeCloseTo(0, 6);
        expect(v[0].y).toBeCloseTo(0, 6);
        expect(v[1].x).toBeCloseTo(10, 6);
        expect(v[1].y).toBeCloseTo(10, 6);
        expect(v[2].x).toBeCloseTo(10 - half, 6);
        expect(v[2].y).toBeCloseTo(10 + half, 6);
        expect(v[3].x).toBeCloseTo(-half, 6);
        expect(v[3].y).toBeCloseTo(half, 6);
    });

    it('opposite signed heights place the rectangle on opposite sides of the axis', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const pos = rotatedRectangleVertices(a, b, 5);
        const neg = rotatedRectangleVertices(a, b, -5);
        // Both contain a and b as corners, so the discriminator is the extruded-edge y.
        const maxY = (pts: { x: number; y: number }[]) => Math.max(...pts.map((p) => p.y));
        const minY = (pts: { x: number; y: number }[]) => Math.min(...pts.map((p) => p.y));
        expect(maxY(pos)).toBeCloseTo(5, 10);
        expect(minY(pos)).toBeCloseTo(0, 10);
        expect(minY(neg)).toBeCloseTo(-5, 10);
        expect(maxY(neg)).toBeCloseTo(0, 10);
    });

    it('returns four identical points for a zero-length axis (degenerate)', () => {
        const v = rotatedRectangleVertices({ x: 7, y: 3 }, { x: 7, y: 3 }, 5);
        expect(v).toHaveLength(4);
        for (const p of v) {
            expect(p.x).toBe(7);
            expect(p.y).toBe(3);
        }
    });
});

describe('enforceCW', () => {
    it('reverses a CCW polygon to CW in Y-down', () => {
        // CCW triangle in Y-down: (0,0), (10, 10), (10, 0)
        const ccw = [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 10, y: 0 },
        ];
        expect(signedArea(ccw)).toBeGreaterThan(0);
        const cw = enforceCW(ccw);
        expect(signedArea(cw)).toBeLessThanOrEqual(0);
    });

    it('leaves a CW polygon unchanged', () => {
        const cw = rectangleVertices({ x: 0, y: 0 }, { x: 10, y: 5 });
        const out = enforceCW(cw);
        expect(out).toEqual(cw);
    });
});
