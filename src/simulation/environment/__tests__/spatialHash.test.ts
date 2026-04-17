import { describe, it, expect } from 'vitest';
import { SpatialHash } from '@simulation/environment/spatialHash';

describe('SpatialHash', () => {
    it('throws on non-positive cell size', () => {
        expect(() => new SpatialHash<string>(0)).toThrow();
        expect(() => new SpatialHash<string>(-1)).toThrow();
    });

    it('returns every inserted item for a query covering the whole map', () => {
        const h = new SpatialHash<string>(100);
        h.insert({ x: 10, y: 10, w: 5, h: 5 }, 'a');
        h.insert({ x: 500, y: 500, w: 5, h: 5 }, 'b');
        h.insert({ x: 900, y: 900, w: 5, h: 5 }, 'c');

        const out: string[] = [];
        h.queryAABB({ x: 0, y: 0, w: 1000, h: 1000 }, out);
        expect(new Set(out)).toEqual(new Set(['a', 'b', 'c']));
    });

    it('excludes items whose AABB is far from the query region', () => {
        const h = new SpatialHash<string>(100);
        h.insert({ x: 10, y: 10, w: 5, h: 5 }, 'near');
        h.insert({ x: 900, y: 900, w: 5, h: 5 }, 'far');

        const out: string[] = [];
        h.queryAABB({ x: 0, y: 0, w: 50, h: 50 }, out);
        expect(out).toContain('near');
        expect(out).not.toContain('far');
    });

    it('records items that straddle multiple cells in every overlapping cell', () => {
        const h = new SpatialHash<string>(100);
        // Straddles cells (0,0) and (1,0) and (0,1) and (1,1)
        h.insert({ x: 50, y: 50, w: 100, h: 100 }, 'big');

        const out: string[] = [];
        h.queryAABB({ x: 0, y: 0, w: 1, h: 1 }, out);
        expect(out).toContain('big');

        const out2: string[] = [];
        h.queryAABB({ x: 199, y: 199, w: 1, h: 1 }, out2);
        expect(out2).toContain('big');
    });

    it('clears the out buffer before writing (reusable)', () => {
        const h = new SpatialHash<string>(100);
        h.insert({ x: 10, y: 10, w: 5, h: 5 }, 'a');

        const out: string[] = ['stale-1', 'stale-2', 'stale-3'];
        h.queryAABB({ x: 0, y: 0, w: 50, h: 50 }, out);
        expect(out).not.toContain('stale-1');
        expect(out).toContain('a');
    });

    it('size() reflects number of insert calls', () => {
        const h = new SpatialHash<number>(100);
        expect(h.size()).toBe(0);
        h.insert({ x: 0, y: 0, w: 10, h: 10 }, 1);
        h.insert({ x: 20, y: 0, w: 10, h: 10 }, 2);
        expect(h.size()).toBe(2);
    });

    it('all() returns items in insertion order', () => {
        const h = new SpatialHash<string>(100);
        h.insert({ x: 0, y: 0, w: 1, h: 1 }, 'first');
        h.insert({ x: 0, y: 0, w: 1, h: 1 }, 'second');
        h.insert({ x: 0, y: 0, w: 1, h: 1 }, 'third');
        expect(Array.from(h.all())).toEqual(['first', 'second', 'third']);
    });
});
