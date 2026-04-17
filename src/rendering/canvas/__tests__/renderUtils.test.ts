import { describe, it, expect } from 'vitest';
import { swapRemove } from '@rendering/canvas/renderUtils';

describe('swapRemove', () => {
    it('given [A, B, C], when removing index 0, then result is [C, B]', () => {
        const arr = ['A', 'B', 'C'];
        swapRemove(arr, 0);
        expect(arr).toEqual(['C', 'B']);
    });

    it('given [A, B, C], when removing last index, then result is [A, B]', () => {
        const arr = ['A', 'B', 'C'];
        swapRemove(arr, 2);
        expect(arr).toEqual(['A', 'B']);
    });

    it('given [A, B, C], when removing index 1, then result is [A, C]', () => {
        const arr = ['A', 'B', 'C'];
        swapRemove(arr, 1);
        expect(arr).toEqual(['A', 'C']);
    });

    it('given single-element [A], when removing index 0, then result is empty', () => {
        const arr = ['A'];
        swapRemove(arr, 0);
        expect(arr).toEqual([]);
    });

    it('given [A, B], when removing index 0, then result is [B]', () => {
        const arr = ['A', 'B'];
        swapRemove(arr, 0);
        expect(arr).toEqual(['B']);
    });
});
