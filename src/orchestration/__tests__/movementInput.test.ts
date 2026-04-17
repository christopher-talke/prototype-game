import { describe, it, expect, beforeEach } from 'vitest';
import { getMovementInput } from '@orchestration/movementInput';
import { HELD_DIRECTIONS, directions } from '@simulation/player/playerData';

beforeEach(() => {
    HELD_DIRECTIONS.length = 0;
});

describe('getMovementInput', () => {
    it('given no directions held, then returns zero vector', () => {
        expect(getMovementInput()).toEqual({ dx: 0, dy: 0 });
    });

    it('given only right held, then returns dx=1 dy=0', () => {
        HELD_DIRECTIONS.push(directions.right);
        expect(getMovementInput()).toEqual({ dx: 1, dy: 0 });
    });

    it('given only up held, then returns dx=0 dy=-1', () => {
        HELD_DIRECTIONS.push(directions.up);
        expect(getMovementInput()).toEqual({ dx: 0, dy: -1 });
    });

    it('given right and up held (diagonal), then returns normalized vector', () => {
        HELD_DIRECTIONS.push(directions.right, directions.up);
        const result = getMovementInput();
        expect(result.dx).toBeCloseTo(1 / Math.SQRT2);
        expect(result.dy).toBeCloseTo(-1 / Math.SQRT2);
    });

    it('given left and down held, then returns normalized diagonal', () => {
        HELD_DIRECTIONS.push(directions.left, directions.down);
        const result = getMovementInput();
        expect(result.dx).toBeCloseTo(-1 / Math.SQRT2);
        expect(result.dy).toBeCloseTo(1 / Math.SQRT2);
    });

    it('given opposing left and right held, then last-written wins (right overwrites left)', () => {
        HELD_DIRECTIONS.push(directions.left, directions.right);
        const result = getMovementInput();
        // Loop iterates in order: left sets dx=-1, then right sets dx=1
        expect(result.dx).toBe(1);
        expect(result.dy).toBe(0);
    });
});
