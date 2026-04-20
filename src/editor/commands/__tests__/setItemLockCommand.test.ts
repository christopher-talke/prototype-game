/**
 * Tests for buildSetItemLockCommand: toggles per-item `locked` and round-trips
 * through undo/redo.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, Wall } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildSetItemLockCommand } from '../setItemLockCommand';

function mkWall(id: string): Wall {
    return {
        id,
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ],
        solid: true,
        bulletPenetrable: false,
        penetrationDecay: 0,
        audioOcclude: true,
        occludesVision: true,
        wallType: 'concrete',
    };
}

function mkState() {
    const map: MapData = createDefaultMapData();
    map.layers[0].walls.push(mkWall('wall-1'));
    return createWorkingState(map);
}

describe('buildSetItemLockCommand', () => {
    it('locks a wall and round-trips through undo/redo', () => {
        const state = mkState();
        const cmd = buildSetItemLockCommand(state, 'wall-1', true);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        const after = state.map.layers[0].walls.find((w) => w.id === 'wall-1')!;
        expect(after.locked).toBe(true);

        cmd!.undo(state);
        const restored = state.map.layers[0].walls.find((w) => w.id === 'wall-1')!;
        expect(restored.locked).toBeUndefined();

        cmd!.do(state);
        const redone = state.map.layers[0].walls.find((w) => w.id === 'wall-1')!;
        expect(redone.locked).toBe(true);
    });

    it('returns null when the flag is already explicitly set to the requested value', () => {
        const state = mkState();
        state.map.layers[0].walls[0].locked = true;
        expect(buildSetItemLockCommand(state, 'wall-1', true)).toBe(null);
    });

    it('returns null for an unknown guid', () => {
        const state = mkState();
        expect(buildSetItemLockCommand(state, 'nope', true)).toBe(null);
    });

    it('description reflects the direction of the toggle', () => {
        const state = mkState();
        expect(buildSetItemLockCommand(state, 'wall-1', true)!.description).toBe('Lock item');
        const state2 = mkState();
        state2.map.layers[0].walls[0].locked = true;
        expect(buildSetItemLockCommand(state2, 'wall-1', false)!.description).toBe('Unlock item');
    });
});
