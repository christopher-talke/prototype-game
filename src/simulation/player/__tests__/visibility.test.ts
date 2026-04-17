import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FOV, ROTATION_OFFSET } from '../../../constants';
import { makePlayer } from '../../../test/helpers';

// We need fresh module state per describe block because visibility.ts
// has a module-level wasVisible Map. Use dynamic imports.
// Also need to handle ACTIVE_PLAYER from playerRegistry.

describe('isFacingTarget', () => {
    let isFacingTarget: typeof import('@simulation/player/visibility').isFacingTarget;

    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('@simulation/player/visibility');
        isFacingTarget = mod.isFacingTarget;
    });

    it('given target directly ahead, when checking, then returns true', () => {
        // Source at (0,0) facing right (rotation = 0 + ROTATION_OFFSET = 90)
        // Target at (100, 0) -- directly to the right
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: 100, y: 0, rotation: 0 } });
        expect(isFacingTarget(source, target)).toBe(true);
    });

    it('given target behind source, when checking, then returns false', () => {
        // Source facing right (rotation = 90), target to the left at (-100, 0)
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: -100, y: 0, rotation: 0 } });
        expect(isFacingTarget(source, target)).toBe(false);
    });

    it('given target just inside FOV boundary, when checking, then returns true', () => {
        // FOV = 55 degrees each side. Place target at ~50 degrees off.
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const angleOff = 50; // within FOV of 55
        const rad = (angleOff * Math.PI) / 180;
        const target = makePlayer({
            id: 2,
            current_position: { x: Math.cos(rad) * 100, y: Math.sin(rad) * 100, rotation: 0 },
        });
        expect(isFacingTarget(source, target)).toBe(true);
    });

    it('given target just outside FOV boundary, when checking, then returns false', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const angleOff = 60; // outside FOV of 55
        const rad = (angleOff * Math.PI) / 180;
        const target = makePlayer({
            id: 2,
            current_position: { x: Math.cos(rad) * 100, y: Math.sin(rad) * 100, rotation: 0 },
        });
        expect(isFacingTarget(source, target)).toBe(false);
    });
});

describe('lineOfSight', () => {
    let lineOfSight: typeof import('@simulation/player/visibility').lineOfSight;

    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('@simulation/player/visibility');
        lineOfSight = mod.lineOfSight;
        // Set ACTIVE_PLAYER to a known value
        const registry = await import('@simulation/player/playerRegistry');
        registry.setActivePlayer(1);
    });

    it('given not blocked and facing target, when checking, then canSee is true', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: 100, y: 0, rotation: 0 } });
        const result = lineOfSight(false, target, source);
        expect(result.canSee).toBe(true);
    });

    it('given blocked, when checking, then canSee is false', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: 100, y: 0, rotation: 0 } });
        const result = lineOfSight(true, target, source);
        expect(result.canSee).toBe(false);
    });

    it('given not blocked but not facing target, when checking, then canSee is false', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: -100, y: 0, rotation: 0 } }); // behind
        const result = lineOfSight(false, target, source);
        expect(result.canSee).toBe(false);
    });

    it('given first call for pair, when checking, then stateChanged is true', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: 100, y: 0, rotation: 0 } });
        const result = lineOfSight(false, target, source);
        expect(result.stateChanged).toBe(true);
    });

    it('given same visibility state on second call, when checking, then stateChanged is false', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: 100, y: 0, rotation: 0 } });
        lineOfSight(false, target, source); // first call
        const result = lineOfSight(false, target, source); // same state
        expect(result.stateChanged).toBe(false);
    });

    it('given visibility flips from visible to not-visible, when checking, then stateChanged is true', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: 100, y: 0, rotation: 0 } });
        lineOfSight(false, target, source); // visible
        const result = lineOfSight(true, target, source); // now blocked
        expect(result.stateChanged).toBe(true);
        expect(result.canSee).toBe(false);
    });

    it('given source is ACTIVE_PLAYER, when checking, then isLocalView is true', () => {
        const source = makePlayer({ id: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, current_position: { x: 100, y: 0, rotation: 0 } });
        const result = lineOfSight(false, target, source);
        expect(result.isLocalView).toBe(true);
    });

    it('given same team, when checking, then sameTeam is true', () => {
        const source = makePlayer({ id: 1, team: 1, current_position: { x: 0, y: 0, rotation: ROTATION_OFFSET } });
        const target = makePlayer({ id: 2, team: 1, current_position: { x: 100, y: 0, rotation: 0 } });
        const result = lineOfSight(false, target, source);
        expect(result.sameTeam).toBe(true);
    });
});
