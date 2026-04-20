/**
 * Tests for buildMoveMemberCommand.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { EditorWorkingState, ItemRef } from '../../state/EditorWorkingState';
import type { Group } from '../../groups/Group';
import { MAX_GROUP_DEPTH } from '../../groups/Group';
import { buildMoveMemberCommand } from '../moveMemberCommand';

function mkItem(id: string, floorId = 'f1', layerId = 'l1'): ItemRef {
    return { kind: 'wall', guid: id, name: id, floorId, layerId };
}

function mkState(items: ItemRef[], groups: Group[]): EditorWorkingState {
    const byGUID = new Map<string, ItemRef>();
    for (const i of items) byGUID.set(i.guid, i);
    const groupMap = new Map<string, Group>();
    for (const g of groups) groupMap.set(g.id, g);
    return {
        map: null as unknown as EditorWorkingState['map'],
        byGUID,
        byLayer: new Map(),
        byFloor: new Map(),
        counters: new Map(),
        activeFloorId: 'f1',
        activeLayerId: 'l1',
        editorHiddenGUIDs: new Set(),
        groups: groupMap,
    };
}

describe('buildMoveMemberCommand', () => {
    it('reorders an item within the same group (before)', () => {
        const state = mkState(
            [mkItem('a'), mkItem('b'), mkItem('c')],
            [{ id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b', 'c'], parentGroupId: null }],
        );
        const cmd = buildMoveMemberCommand(state, 'c', {
            kind: 'group',
            groupId: 'g1',
            anchorMemberId: 'a',
            position: 'before',
        });
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['c', 'a', 'b']);
        cmd!.undo(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a', 'b', 'c']);
    });

    it('reorders an item within the same group (after)', () => {
        const state = mkState(
            [mkItem('a'), mkItem('b'), mkItem('c')],
            [{ id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b', 'c'], parentGroupId: null }],
        );
        const cmd = buildMoveMemberCommand(state, 'a', {
            kind: 'group',
            groupId: 'g1',
            anchorMemberId: 'c',
            position: 'after',
        });
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['b', 'c', 'a']);
    });

    it('moves an item from root into a group', () => {
        const state = mkState(
            [mkItem('a'), mkItem('b'), mkItem('c')],
            [{ id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b'], parentGroupId: null }],
        );
        const cmd = buildMoveMemberCommand(state, 'c', {
            kind: 'group',
            groupId: 'g1',
            anchorMemberId: 'b',
            position: 'after',
        });
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a', 'b', 'c']);
        cmd!.undo(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a', 'b']);
    });

    it('moves an item from group to root', () => {
        const state = mkState(
            [mkItem('a'), mkItem('b')],
            [{ id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b'], parentGroupId: null }],
        );
        const cmd = buildMoveMemberCommand(state, 'b', { kind: 'root' });
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a']);
        cmd!.undo(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a', 'b']);
    });

    it('moves an item between sibling groups', () => {
        const state = mkState(
            [mkItem('a'), mkItem('b'), mkItem('c')],
            [
                { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b'], parentGroupId: null },
                { id: 'g2', name: 'g2', floorId: 'f1', memberIds: ['c'], parentGroupId: null },
            ],
        );
        const cmd = buildMoveMemberCommand(state, 'b', {
            kind: 'group',
            groupId: 'g2',
            anchorMemberId: 'c',
            position: 'before',
        });
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a']);
        expect(state.groups.get('g2')!.memberIds).toEqual(['b', 'c']);
        cmd!.undo(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a', 'b']);
        expect(state.groups.get('g2')!.memberIds).toEqual(['c']);
    });

    it('reparents a nested group under a new parent and updates parentGroupId', () => {
        const state = mkState(
            [mkItem('a'), mkItem('b')],
            [
                { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a'], parentGroupId: null },
                { id: 'g2', name: 'g2', floorId: 'f1', memberIds: ['b'], parentGroupId: null },
                { id: 'gChild', name: 'child', floorId: 'f1', memberIds: [], parentGroupId: 'g1' },
            ],
        );
        state.groups.get('g1')!.memberIds = ['a', 'gChild'];
        const cmd = buildMoveMemberCommand(state, 'gChild', {
            kind: 'group',
            groupId: 'g2',
            anchorMemberId: 'b',
            position: 'after',
        });
        cmd!.do(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a']);
        expect(state.groups.get('g2')!.memberIds).toEqual(['b', 'gChild']);
        expect(state.groups.get('gChild')!.parentGroupId).toBe('g2');
        cmd!.undo(state);
        expect(state.groups.get('gChild')!.parentGroupId).toBe('g1');
        expect(state.groups.get('g1')!.memberIds).toEqual(['a', 'gChild']);
        expect(state.groups.get('g2')!.memberIds).toEqual(['b']);
    });

    it('rejects reparenting that would create a cycle', () => {
        const state = mkState(
            [],
            [
                { id: 'gOuter', name: 'outer', floorId: 'f1', memberIds: ['gInner'], parentGroupId: null },
                { id: 'gInner', name: 'inner', floorId: 'f1', memberIds: [], parentGroupId: 'gOuter' },
            ],
        );
        const cmd = buildMoveMemberCommand(state, 'gOuter', {
            kind: 'group-end',
            groupId: 'gInner',
        });
        expect(cmd).toBe(null);
    });

    it('rejects a reparent that would exceed MAX_GROUP_DEPTH', () => {
        expect(MAX_GROUP_DEPTH).toBeGreaterThanOrEqual(2);
        const chain: Group[] = [];
        for (let i = 0; i < MAX_GROUP_DEPTH; i++) {
            chain.push({
                id: `g${i}`,
                name: `g${i}`,
                floorId: 'f1',
                memberIds: i < MAX_GROUP_DEPTH - 1 ? [`g${i + 1}`] : [],
                parentGroupId: i === 0 ? null : `g${i - 1}`,
            });
        }
        const loose: Group = {
            id: 'loose',
            name: 'loose',
            floorId: 'f1',
            memberIds: [],
            parentGroupId: null,
        };
        const state = mkState([], [...chain, loose]);
        const cmd = buildMoveMemberCommand(state, 'loose', {
            kind: 'group-end',
            groupId: `g${MAX_GROUP_DEPTH - 1}`,
        });
        expect(cmd).toBe(null);
    });

    it('rejects cross-floor group moves', () => {
        const state = mkState(
            [mkItem('a', 'f1')],
            [
                { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a'], parentGroupId: null },
                { id: 'g2', name: 'g2', floorId: 'f2', memberIds: [], parentGroupId: null },
            ],
        );
        const cmd = buildMoveMemberCommand(state, 'a', {
            kind: 'group-end',
            groupId: 'g2',
        });
        expect(cmd).toBe(null);
    });

    it('returns null when moving an unknown id', () => {
        const state = mkState([], []);
        expect(buildMoveMemberCommand(state, 'ghost', { kind: 'root' })).toBe(null);
    });

    it('returns null when root-target is requested for an already-root node', () => {
        const state = mkState([mkItem('a')], []);
        expect(buildMoveMemberCommand(state, 'a', { kind: 'root' })).toBe(null);
    });

    it('returns null on no-op same-position move', () => {
        const state = mkState(
            [mkItem('a'), mkItem('b')],
            [{ id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b'], parentGroupId: null }],
        );
        const cmd = buildMoveMemberCommand(state, 'a', {
            kind: 'group',
            groupId: 'g1',
            anchorMemberId: 'b',
            position: 'before',
        });
        expect(cmd).toBe(null);
    });
});
