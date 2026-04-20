/**
 * Tests for buildSetItemVisibilityCommand: toggles per-item `hidden` and
 * round-trips through undo/redo.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, Wall } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildSetItemVisibilityCommand } from '../setItemVisibilityCommand';

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

describe('buildSetItemVisibilityCommand', () => {
    it('hides a wall and round-trips through undo/redo', () => {
        const state = mkState();
        const cmd = buildSetItemVisibilityCommand(state, 'wall-1', true);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        const after = state.map.layers[0].walls.find((w) => w.id === 'wall-1')!;
        expect(after.hidden).toBe(true);

        cmd!.undo(state);
        const restored = state.map.layers[0].walls.find((w) => w.id === 'wall-1')!;
        expect(restored.hidden).toBeUndefined();

        cmd!.do(state);
        const redone = state.map.layers[0].walls.find((w) => w.id === 'wall-1')!;
        expect(redone.hidden).toBe(true);
    });

    it('returns null when the flag is already explicitly set to the requested value', () => {
        const state = mkState();
        state.map.layers[0].walls[0].hidden = true;
        expect(buildSetItemVisibilityCommand(state, 'wall-1', true)).toBe(null);
    });

    it('returns null for an unknown guid', () => {
        const state = mkState();
        expect(buildSetItemVisibilityCommand(state, 'nope', true)).toBe(null);
    });

    it('description reflects the direction of the toggle', () => {
        const state = mkState();
        expect(buildSetItemVisibilityCommand(state, 'wall-1', true)!.description).toBe('Hide item');
        const state2 = mkState();
        state2.map.layers[0].walls[0].hidden = true;
        expect(buildSetItemVisibilityCommand(state2, 'wall-1', false)!.description).toBe(
            'Show item',
        );
    });
});
