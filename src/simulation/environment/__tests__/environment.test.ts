import { describe, it, expect, afterEach } from 'vitest';
import {
    environment,
    makeSegment,
    generateEnvironment,
    setEnvironmentLimits,
    clearWallGeometry,
} from '@simulation/environment/environment';

afterEach(() => {
    // Restore default state
    environment.limits.left = 0;
    environment.limits.right = 3000;
    environment.limits.top = 0;
    environment.limits.bottom = 3000;
    clearWallGeometry();
});

describe('makeSegment', () => {
    it('given coordinates, when creating segment, then stores correct values', () => {
        const seg = makeSegment(10, 20, 30, 40);
        expect(seg.x1).toBe(10);
        expect(seg.y1).toBe(20);
        expect(seg.x2).toBe(30);
        expect(seg.y2).toBe(40);
    });

    it('given top-left to bottom-right, when creating segment, then computes correct AABB', () => {
        const seg = makeSegment(10, 20, 50, 80);
        expect(seg.minX).toBe(10);
        expect(seg.minY).toBe(20);
        expect(seg.maxX).toBe(50);
        expect(seg.maxY).toBe(80);
    });

    it('given reversed endpoints (bottom-right to top-left), when creating segment, then computes correct AABB', () => {
        const seg = makeSegment(50, 80, 10, 20);
        expect(seg.minX).toBe(10);
        expect(seg.minY).toBe(20);
        expect(seg.maxX).toBe(50);
        expect(seg.maxY).toBe(80);
    });
});

describe('generateEnvironment', () => {
    it('given default limits, when generating, then creates exactly 4 boundary segments', () => {
        generateEnvironment();
        expect(environment.segments).toHaveLength(4);
    });

    it('given default limits, when generating, then creates 4 corners', () => {
        generateEnvironment();
        expect(environment.corners).toHaveLength(4);
        expect(environment.corners).toContainEqual({ x: 0, y: 0 });
        expect(environment.corners).toContainEqual({ x: 3000, y: 0 });
        expect(environment.corners).toContainEqual({ x: 3000, y: 3000 });
        expect(environment.corners).toContainEqual({ x: 0, y: 3000 });
    });
});

describe('setEnvironmentLimits', () => {
    it('given new dimensions, when setting limits, then updates right and bottom', () => {
        setEnvironmentLimits(5000, 4000);
        expect(environment.limits.right).toBe(5000);
        expect(environment.limits.bottom).toBe(4000);
    });

    it('given new dimensions, when setting limits, then regenerates segments matching new limits', () => {
        setEnvironmentLimits(2000, 1500);
        expect(environment.segments).toHaveLength(4);
        // Top segment should go from (0,0) to (2000,0)
        const topSeg = environment.segments.find(s => s.y1 === 0 && s.y2 === 0);
        expect(topSeg).toBeDefined();
        expect(topSeg!.x2).toBe(2000);
    });
});
