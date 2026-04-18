import { describe, it, expect, beforeEach } from 'vitest';
import {
    collidesWithWalls,
    collidesWithPlayers,
    clampToBounds,
    moveWithCollisionPure,
    clearWallAABBs,
} from '@simulation/player/collision';
import { PLAYER_HIT_BOX } from '../../../constants';
import { makePlayer, makeWall, testLimits } from '../../../test/helpers';

// collision.ts internals: COLLISION_MARGIN = 3, CBOX = PLAYER_HIT_BOX - 6 = 38

beforeEach(() => {
    clearWallAABBs();
});

describe('collidesWithWalls', () => {
    it('given no walls, when checking collision, then returns false', () => {
        expect(collidesWithWalls(100, 100, [])).toBe(false);
    });

    it('given player clearly outside wall, when checking collision, then returns false', () => {
        const walls = [makeWall(200, 200, 50, 50)];
        expect(collidesWithWalls(0, 0, walls)).toBe(false);
    });

    it('given player overlapping wall, when checking collision, then returns true', () => {
        const walls = [makeWall(100, 100, 50, 50)];
        // Player at (95, 95) with COLLISION_MARGIN=3 -> check box starts at (98, 98), size 38
        // Wall from (100,100) to (150,150). Box (98,98)-(136,136) overlaps (100,100)-(150,150)
        expect(collidesWithWalls(95, 95, walls)).toBe(true);
    });

    it('given player edge exactly 1px outside wall, when checking collision, then returns false', () => {
        const walls = [makeWall(200, 200, 50, 50)];
        // Player collision box: (px+3, py+3) to (px+3+38, py+3+38) = (px+3, py+3) to (px+41, py+41)
        // For no overlap with wall starting at x=200: px+41 <= 200 -> px <= 159
        expect(collidesWithWalls(159, 0, walls)).toBe(false);
    });

    it('given player inside large wall, when checking collision, then returns true', () => {
        const walls = [makeWall(0, 0, 1000, 1000)];
        expect(collidesWithWalls(500, 500, walls)).toBe(true);
    });

    it('given multiple walls, when player overlaps second wall, then returns true', () => {
        const walls = [makeWall(0, 0, 10, 10), makeWall(500, 500, 50, 50)];
        expect(collidesWithWalls(500, 500, walls)).toBe(true);
    });
});

describe('collidesWithPlayers', () => {
    it('given no other players, when checking collision, then returns false', () => {
        expect(collidesWithPlayers(100, 100, 1, [])).toBe(false);
    });

    it('given excluded player at same position, when checking collision, then returns false', () => {
        const players = [makePlayer({ id: 1, current_position: { x: 100, y: 100, rotation: 0 } })];
        expect(collidesWithPlayers(100, 100, 1, players)).toBe(false);
    });

    it('given another alive player at same position, when checking collision, then returns true', () => {
        const players = [makePlayer({ id: 2, current_position: { x: 100, y: 100, rotation: 0 } })];
        expect(collidesWithPlayers(100, 100, 1, players)).toBe(true);
    });

    it('given dead player at same position, when checking collision, then returns false', () => {
        const players = [makePlayer({ id: 2, current_position: { x: 100, y: 100, rotation: 0 }, dead: true })];
        expect(collidesWithPlayers(100, 100, 1, players)).toBe(false);
    });

    it('given adjacent player not overlapping, when checking collision, then returns false', () => {
        // CBOX = 38, COLLISION_MARGIN = 3. Player 2 at x=141 means gap between collision boxes:
        // Player 1 box: (103, 103)-(141, 141), Player 2 box: (144, 103)-(182, 141) - no overlap
        const players = [makePlayer({ id: 2, current_position: { x: 141, y: 100, rotation: 0 } })];
        expect(collidesWithPlayers(100, 100, 1, players)).toBe(false);
    });
});

describe('clampToBounds', () => {
    const limits = testLimits(1000, 1000);

    it('given position inside bounds, when clamping, then returns unchanged', () => {
        const result = clampToBounds(500, 500, limits);
        expect(result).toEqual({ x: 500, y: 500 });
    });

    it('given x below left boundary, when clamping, then clamps to left', () => {
        const result = clampToBounds(-10, 500, limits);
        expect(result.x).toBe(0);
    });

    it('given x beyond right boundary, when clamping, then clamps to right minus PLAYER_HIT_BOX', () => {
        const result = clampToBounds(1000, 500, limits);
        expect(result.x).toBe(1000 - PLAYER_HIT_BOX);
    });

    it('given y below top boundary, when clamping, then clamps to top', () => {
        const result = clampToBounds(500, -10, limits);
        expect(result.y).toBe(0);
    });

    it('given y beyond bottom boundary, when clamping, then clamps to bottom minus PLAYER_HIT_BOX', () => {
        const result = clampToBounds(500, 1000, limits);
        expect(result.y).toBe(1000 - PLAYER_HIT_BOX);
    });
});

describe('moveWithCollisionPure', () => {
    const limits = testLimits(2000, 2000);

    it('given no walls, when moving, then returns clamped new position', () => {
        const result = moveWithCollisionPure(100, 100, 10, 10, [], limits);
        expect(result).toEqual({ x: 110, y: 110 });
    });

    it('given wall blocking diagonal, when X-only is free, then slides along X', () => {
        // Wall only blocks Y movement; X slide is free
        const wallsV2 = [makeWall(0, 150, 2000, 50)];
        // Moving from (100, 100) by (10, 60). Diagonal to (110, 160):
        // cbox (113,163)-(151,201) vs wall (0,150)-(2000,200) -> overlaps
        // X-only (110, 100): cbox (113,103)-(151,141) vs wall (0,150)-(2000,200) -> 141<150 -> no overlap! Slides X
        const result = moveWithCollisionPure(100, 100, 10, 60, wallsV2, limits);
        expect(result.x).toBe(110);
        expect(result.y).toBe(100);
    });

    it('given wall blocking X, when Y-only is free, then slides along Y', () => {
        const walls = [makeWall(150, 0, 50, 2000)];
        // Moving from (100, 100) by (60, 10). Diagonal (160, 110):
        // cbox (163,113)-(201,151) vs wall (150,0)-(200,2000) -> overlaps
        // X-only (160, 100): cbox (163,103)-(201,141) vs wall -> overlaps
        // Y-only (100, 110): cbox (103,113)-(141,151) vs wall -> 141<150 -> no overlap! Slides Y
        const result = moveWithCollisionPure(100, 100, 60, 10, walls, limits);
        expect(result.x).toBe(100);
        expect(result.y).toBe(110);
    });

    it('given wall blocking both axes, when completely stuck, then returns original position', () => {
        // Surround the player
        const walls = [
            makeWall(0, 0, 2000, 98),   // top wall
            makeWall(0, 142, 2000, 50),  // bottom wall
            makeWall(0, 0, 98, 2000),    // left wall
            makeWall(142, 0, 50, 2000),  // right wall
        ];
        const result = moveWithCollisionPure(100, 100, 10, 10, walls, limits);
        expect(result).toEqual({ x: 100, y: 100 });
    });

    it('given player collision enabled, when another player blocks path, then does not move through', () => {
        // Place player 2 directly in front at dx=10. Collision boxes overlap when distance < CBOX(38).
        const other = makePlayer({ id: 2, current_position: { x: 140, y: 100, rotation: 0 } });
        // Moving from (100,100) by (50, 0). Destination (150, 100):
        // Self cbox at (150,100): (153,103)-(191,141). Other cbox at (140,100): (143,103)-(181,141) -> overlaps
        // X-only same since dy=0. Y-only is (100,100)+(0,0)=no move since dy=0.
        const result = moveWithCollisionPure(100, 100, 50, 0, [], limits, 1, [other]);
        expect(result).toEqual({ x: 100, y: 100 });
    });

    it('given no excludeId or players, when moving, then ignores player collision', () => {
        const result = moveWithCollisionPure(100, 100, 10, 10, [], limits);
        expect(result).toEqual({ x: 110, y: 110 });
    });
});
