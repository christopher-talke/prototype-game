/**
 * Tests for the pure `nextOverlapGuid` helper that drives Tab / Shift-Tab
 * overlap cycling in `EditorApp`.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import { nextOverlapGuid } from '../../selection/overlapCycle';

describe('nextOverlapGuid', () => {
    const hits = ['A', 'B', 'C'];

    it('moves forward one step', () => {
        expect(nextOverlapGuid(hits, 'A', 1)).toBe('B');
        expect(nextOverlapGuid(hits, 'B', 1)).toBe('C');
    });

    it('wraps forward at the end', () => {
        expect(nextOverlapGuid(hits, 'C', 1)).toBe('A');
    });

    it('moves backward one step', () => {
        expect(nextOverlapGuid(hits, 'C', -1)).toBe('B');
        expect(nextOverlapGuid(hits, 'B', -1)).toBe('A');
    });

    it('wraps backward at the start', () => {
        expect(nextOverlapGuid(hits, 'A', -1)).toBe('C');
    });

    it('returns null when fewer than 2 hits', () => {
        expect(nextOverlapGuid([], 'A', 1)).toBeNull();
        expect(nextOverlapGuid(['A'], 'A', 1)).toBeNull();
        expect(nextOverlapGuid(['A'], 'A', -1)).toBeNull();
    });

    it('returns null when current guid is not present', () => {
        expect(nextOverlapGuid(hits, 'Z', 1)).toBeNull();
        expect(nextOverlapGuid(hits, 'Z', -1)).toBeNull();
    });
});
