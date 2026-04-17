import { describe, it, expect } from 'vitest';
import type { NavHint } from '@shared/map/MapData';
import { NavHintRegistry, sampleWeighted } from '@orchestration/bootstrap/aiCompiler';

function hint(id: string, type: NavHint['type'], weight: number): NavHint {
    return { id, type, position: { x: 0, y: 0 }, radius: 10, weight };
}

describe('NavHintRegistry bucketing', () => {
    it('partitions mixed hints by type', () => {
        const reg = new NavHintRegistry([
            hint('c1', 'cover', 0.9),
            hint('c2', 'cover', 0.1),
            hint('k1', 'choke', 0.5),
        ]);
        expect(reg.getByType('cover').map((h) => h.id)).toEqual(['c1', 'c2']);
        expect(reg.getByType('choke').map((h) => h.id)).toEqual(['k1']);
        expect(reg.getByType('flank')).toEqual([]);
    });

    it('sorts each bucket by descending weight', () => {
        const reg = new NavHintRegistry([
            hint('low', 'cover', 0.2),
            hint('high', 'cover', 0.8),
            hint('mid', 'cover', 0.5),
        ]);
        expect(reg.getByType('cover').map((h) => h.id)).toEqual(['high', 'mid', 'low']);
    });

    it('hasType reflects presence', () => {
        const reg = new NavHintRegistry([hint('c1', 'cover', 0.5)]);
        expect(reg.hasType('cover')).toBe(true);
        expect(reg.hasType('choke')).toBe(false);
    });
});

describe('sampleWeighted', () => {
    it('returns null on empty bucket', () => {
        expect(sampleWeighted([])).toBeNull();
    });

    it('samples proportional to weight', () => {
        const hints = [
            hint('a', 'cover', 0.9),
            hint('b', 'cover', 0.1),
            hint('c', 'cover', 0.9),
            hint('d', 'cover', 0.1),
        ];
        // Deterministic pseudo-random: 10k samples; highs (a,c) should dominate.
        let seed = 1;
        const rng = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x100000000;
        };
        const counts = { a: 0, b: 0, c: 0, d: 0 };
        for (let i = 0; i < 10000; i++) {
            const h = sampleWeighted(hints, rng)!;
            counts[h.id as keyof typeof counts]++;
        }
        const highs = counts.a + counts.c;
        const lows = counts.b + counts.d;
        // Expected ratio 9:1, allow wide tolerance for RNG variance.
        expect(highs / lows).toBeGreaterThan(5);
    });

    it('falls back to first hint when total weight is zero', () => {
        const hints = [
            hint('a', 'cover', 0),
            hint('b', 'cover', 0),
        ];
        expect(sampleWeighted(hints)!.id).toBe('a');
    });
});
