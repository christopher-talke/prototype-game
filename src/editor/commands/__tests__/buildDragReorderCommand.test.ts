/**
 * Tests for buildDragReorderCommand: dispatches drag drops to the right
 * underlying builder based on where source and target live.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, Wall } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildDragReorderCommand } from '../buildDragReorderCommand';

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

function mkMap(ids: string[]): MapData {
    const map = createDefaultMapData();
    for (const id of ids) map.layers[0].walls.push(mkWall(id));
    return map;
}

describe('buildDragReorderCommand', () => {
    it('routes root-root same-array drops to buildReorderItemCommand', () => {
        const state = createWorkingState(mkMap(['a', 'b', 'c']));
        const cmd = buildDragReorderCommand(state, 'c', 'a', 'before');
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.map.layers[0].walls.map((w) => w.id)).toEqual(['c', 'a', 'b']);
    });

    it('routes same-group drops to a member-reorder command', () => {
        const state = createWorkingState(mkMap(['a', 'b', 'c']));
        state.groups.set('g1', {
            id: 'g1',
            name: 'g1',
            floorId: 'ground',
            memberIds: ['a', 'b', 'c'],
            parentGroupId: null,
        });
        const cmd = buildDragReorderCommand(state, 'c', 'a', 'before');
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['c', 'a', 'b']);
    });

    it('routes root-into-group drops to a member-move command', () => {
        const state = createWorkingState(mkMap(['a', 'b', 'c']));
        state.groups.set('g1', {
            id: 'g1',
            name: 'g1',
            floorId: 'ground',
            memberIds: ['a', 'b'],
            parentGroupId: null,
        });
        const cmd = buildDragReorderCommand(state, 'c', 'b', 'after');
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a', 'b', 'c']);
    });

    it('routes group-to-root drops through a composite command', () => {
        // Group has multiple members so pulling 'b' out does not auto-dissolve
        // it (pruneGroupsAgainstItems cascade-dissolves empty groups).
        const state = createWorkingState(mkMap(['a', 'b', 'c']));
        state.groups.set('g1', {
            id: 'g1',
            name: 'g1',
            floorId: 'ground',
            memberIds: ['b', 'c'],
            parentGroupId: null,
        });
        const cmd = buildDragReorderCommand(state, 'b', 'a', 'before');
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['c']);
        expect(state.map.layers[0].walls.map((w) => w.id)).toEqual(['b', 'a', 'c']);
        cmd!.undo(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['b', 'c']);
        expect(state.map.layers[0].walls.map((w) => w.id)).toEqual(['a', 'b', 'c']);
    });

    it('routes cross-group drops to a member-move into the target group', () => {
        const state = createWorkingState(mkMap(['a', 'b', 'c']));
        state.groups.set('g1', {
            id: 'g1',
            name: 'g1',
            floorId: 'ground',
            memberIds: ['a', 'b'],
            parentGroupId: null,
        });
        state.groups.set('g2', {
            id: 'g2',
            name: 'g2',
            floorId: 'ground',
            memberIds: ['c'],
            parentGroupId: null,
        });
        const cmd = buildDragReorderCommand(state, 'b', 'c', 'before');
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a']);
        expect(state.groups.get('g2')!.memberIds).toEqual(['b', 'c']);
    });

    it('returns null when source and target are the same id', () => {
        const state = createWorkingState(mkMap(['a', 'b']));
        expect(buildDragReorderCommand(state, 'a', 'a', 'before')).toBe(null);
    });

    it('returns null for drops across incompatible backing arrays', () => {
        const map = createDefaultMapData();
        map.layers[0].walls.push(mkWall('w1'));
        map.zones.push({
            id: 'z1',
            type: 'spawn',
            label: 'z1',
            polygon: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
            ],
            floorId: 'ground',
        });
        const state = createWorkingState(map);
        expect(buildDragReorderCommand(state, 'w1', 'z1', 'before')).toBe(null);
    });
});
