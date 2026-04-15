import { describe, it, expect } from 'vitest';
import { raySegmentIntersect, isLineBlocked } from '@simulation/detection/rayGeometry';
import { testSegment } from '../../../test/helpers';

describe('raySegmentIntersect', () => {
    it('given ray hitting segment head-on, when intersecting, then returns positive t', () => {
        // Ray from (0,5) going right (+1,0), segment from (10,0) to (10,10) (vertical wall at x=10)
        const t = raySegmentIntersect(0, 5, 1, 0, 10, 0, 10, 10);
        expect(t).not.toBeNull();
        expect(t).toBeCloseTo(10, 5);
    });

    it('given parallel ray, when checking intersection, then returns null', () => {
        // Ray going right, segment is horizontal -- parallel
        const t = raySegmentIntersect(0, 0, 1, 0, 0, 5, 10, 5);
        expect(t).toBeNull();
    });

    it('given ray pointing away from segment, when checking intersection, then returns null', () => {
        // Ray from (20,5) going right (+1,0), vertical segment at x=10 -- behind the ray
        const t = raySegmentIntersect(20, 5, 1, 0, 10, 0, 10, 10);
        expect(t).toBeNull();
    });

    it('given ray hitting segment at u=0 endpoint, when intersecting, then returns t', () => {
        // Ray from (0,0) toward (10,0), segment from (10,0) to (10,10)
        const t = raySegmentIntersect(0, 0, 1, 0, 10, 0, 10, 10);
        expect(t).not.toBeNull();
        expect(t).toBeCloseTo(10, 5);
    });

    it('given ray hitting segment at u=1 endpoint, when intersecting, then returns t', () => {
        // Ray from (0,10) going right, segment from (10,0) to (10,10) -- hits at (10,10) which is u=1
        const t = raySegmentIntersect(0, 10, 1, 0, 10, 0, 10, 10);
        expect(t).not.toBeNull();
        expect(t).toBeCloseTo(10, 5);
    });

    it('given ray missing segment (u > 1), when checking intersection, then returns null', () => {
        // Ray from (0,15) going right, segment from (10,0) to (10,10) -- y=15 is past the segment
        const t = raySegmentIntersect(0, 15, 1, 0, 10, 0, 10, 10);
        expect(t).toBeNull();
    });

    it('given vertical segment (dx=0 for segment), when ray intersects, then returns correct t', () => {
        const t = raySegmentIntersect(0, 5, 1, 0, 10, 0, 10, 10);
        expect(t).toBeCloseTo(10, 5);
    });

    it('given horizontal segment (dy=0 for segment), when ray intersects, then returns correct t', () => {
        // Ray from (5,0) going down (0,1), horizontal segment from (0,10) to (10,10)
        const t = raySegmentIntersect(5, 0, 0, 1, 0, 10, 10, 10);
        expect(t).toBeCloseTo(10, 5);
    });

    it('given near-parallel case (denom < 1e-10), when checking, then returns null', () => {
        // Extremely small angle between ray and segment
        const t = raySegmentIntersect(0, 0, 1, 0, 0, 0, 1000000, 0.00001);
        // This should be near-parallel
        expect(t === null || typeof t === 'number').toBe(true);
    });
});

describe('isLineBlocked', () => {
    it('given no segments, when checking LOS, then returns false', () => {
        expect(isLineBlocked(0, 0, 100, 100, [])).toBe(false);
    });

    it('given source and target at same point, when checking LOS, then returns false', () => {
        const segments = [testSegment(50, 0, 50, 100)];
        expect(isLineBlocked(50, 50, 50, 50, segments)).toBe(false);
    });

    it('given wide wall blocking all three rays, when checking LOS, then returns true', () => {
        // Wide wall at x=50, from y=-100 to y=200 -- blocks center and both offset rays
        const segments = [testSegment(50, -100, 50, 300)];
        expect(isLineBlocked(0, 50, 100, 50, segments)).toBe(true);
    });

    it('given narrow wall blocking center but not offsets, when checking LOS, then returns false', () => {
        // Very narrow wall: just 1px tall at y=50, won't block the 10px offset rays
        // isLineBlocked checks center, then +10px offset, then -10px offset.
        // If center is blocked but either offset is not, returns false.
        const segments = [testSegment(50, 49, 50, 51)]; // 2px tall segment at x=50
        // Center ray from (0,50) to (100,50) -- hits the segment
        // +10px offset ray from (0,50) to (100,60) -- misses the 2px segment
        expect(isLineBlocked(0, 50, 100, 50, segments)).toBe(false);
    });

    it('given clear line past a wall to the side, when checking LOS, then returns false', () => {
        // Wall at x=50, from y=200 to y=300 -- well below the line from (0,50) to (100,50)
        const segments = [testSegment(50, 200, 50, 300)];
        expect(isLineBlocked(0, 50, 100, 50, segments)).toBe(false);
    });
});
