import { describe, it, expect } from 'vitest';
import { cssTransform } from '@rendering/dom/cssTransform';

describe('cssTransform', () => {
    it('given x and y only, then returns translate3d without rotation', () => {
        expect(cssTransform(100, 200)).toBe('translate3d(100px, 200px, 0)');
    });

    it('given x, y, and rotation, then returns translate3d with rotate', () => {
        expect(cssTransform(0, 0, 45)).toBe('translate3d(0px, 0px, 0) rotate(45deg)');
    });

    it('given negative values, then formats correctly', () => {
        expect(cssTransform(-10, -20)).toBe('translate3d(-10px, -20px, 0)');
    });

    it('given rotation of 0, then includes rotate(0deg)', () => {
        expect(cssTransform(5, 5, 0)).toBe('translate3d(5px, 5px, 0) rotate(0deg)');
    });
});
