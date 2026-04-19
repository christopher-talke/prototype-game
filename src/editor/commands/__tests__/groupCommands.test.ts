import { describe, it, expect } from 'vitest';

import type { EditorWorkingState, ItemRef } from '../../state/EditorWorkingState';
import type { Group } from '../../groups/Group';
import { MAX_GROUP_DEPTH } from '../../groups/Group';
import {
    buildCreateGroupCommand,
    buildDissolveGroupCommand,
    buildRenameGroupCommand,
} from '../groupCommands';

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

describe('buildCreateGroupCommand', () => {
    it('returns null when fewer than 2 members', () => {
        const state = mkState([mkItem('a')], []);
        expect(buildCreateGroupCommand(state, ['a'])).toBe(null);
    });

    it('returns null when members span multiple floors', () => {
        const state = mkState([mkItem('a', 'f1'), mkItem('b', 'f2')], []);
        expect(buildCreateGroupCommand(state, ['a', 'b'])).toBe(null);
    });

    it('creates a group and undo restores the prior state', () => {
        const state = mkState([mkItem('a'), mkItem('b')], []);
        const cmd = buildCreateGroupCommand(state, ['a', 'b']);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(state.groups.size).toBe(1);
        const [group] = [...state.groups.values()];
        expect(group.memberIds.sort()).toEqual(['a', 'b']);
        cmd!.undo(state);
        expect(state.groups.size).toBe(0);
    });

    it('returns null when members have mismatched immediate parents', () => {
        const state = mkState([mkItem('a'), mkItem('b'), mkItem('c')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a'], parentGroupId: null },
        ]);
        // `a` has parent g1; `b` has no parent. Mismatch -> reject.
        expect(buildCreateGroupCommand(state, ['a', 'b'])).toBe(null);
    });

    it('creates a nested group when members share an immediate parent', () => {
        const state = mkState([mkItem('a'), mkItem('b'), mkItem('c')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b', 'c'], parentGroupId: null },
        ]);
        const cmd = buildCreateGroupCommand(state, ['a', 'b']);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        const nested = [...state.groups.values()].find((g) => g.parentGroupId === 'g1');
        expect(nested).toBeDefined();
        const parent = state.groups.get('g1')!;
        expect(parent.memberIds).toContain(nested!.id);
        expect(parent.memberIds).toContain('c');
        expect(parent.memberIds).not.toContain('a');
        expect(parent.memberIds).not.toContain('b');
        cmd!.undo(state);
        expect(state.groups.size).toBe(1);
        expect(state.groups.get('g1')!.memberIds.sort()).toEqual(['a', 'b', 'c']);
    });

    it('rejects a grouping that would exceed MAX_GROUP_DEPTH', () => {
        // Build a chain of MAX_GROUP_DEPTH nested groups each with one item.
        const items: ItemRef[] = [];
        const groups: Group[] = [];
        let prev: string | null = null;
        for (let i = 1; i <= MAX_GROUP_DEPTH; i++) {
            const gid = `g${i}`;
            const iid = `i${i}`;
            items.push(mkItem(iid));
            groups.push({
                id: gid,
                name: gid,
                floorId: 'f1',
                memberIds: [iid, ...(i < MAX_GROUP_DEPTH ? [`g${i + 1}`] : [])],
                parentGroupId: prev,
            });
            prev = gid;
        }
        // Add two new loose items parented under the deepest group.
        const deepest = groups[groups.length - 1];
        items.push(mkItem('x'));
        items.push(mkItem('y'));
        deepest.memberIds.push('x', 'y');
        const state = mkState(items, groups);
        // Attempt to group x and y -- that would nest one level deeper than allowed.
        const cmd = buildCreateGroupCommand(state, ['x', 'y']);
        expect(cmd).toBe(null);
    });
});

describe('buildDissolveGroupCommand', () => {
    it('do/undo round-trips a top-level group', () => {
        const state = mkState([mkItem('a'), mkItem('b')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b'], parentGroupId: null },
        ]);
        const cmd = buildDissolveGroupCommand(state, 'g1')!;
        cmd.do(state);
        expect(state.groups.has('g1')).toBe(false);
        cmd.undo(state);
        expect(state.groups.get('g1')!.memberIds.sort()).toEqual(['a', 'b']);
    });

    it('reparents nested-group children to the dissolved group\'s parent', () => {
        const state = mkState([mkItem('a')], [
            { id: 'gOuter', name: 'outer', floorId: 'f1', memberIds: ['gInner'], parentGroupId: null },
            { id: 'gInner', name: 'inner', floorId: 'f1', memberIds: ['a'], parentGroupId: 'gOuter' },
        ]);
        const cmd = buildDissolveGroupCommand(state, 'gInner')!;
        cmd.do(state);
        expect(state.groups.get('gOuter')!.memberIds).toEqual(['a']);
        cmd.undo(state);
        expect(state.groups.get('gOuter')!.memberIds).toEqual(['gInner']);
        expect(state.groups.get('gInner')!.memberIds).toEqual(['a']);
    });
});

describe('buildRenameGroupCommand', () => {
    it('returns null if name is unchanged', () => {
        const state = mkState([], [
            { id: 'g1', name: 'group-1', floorId: 'f1', memberIds: [], parentGroupId: null },
        ]);
        expect(buildRenameGroupCommand(state, 'g1', 'group-1')).toBe(null);
    });

    it('do/undo restores the previous name', () => {
        const state = mkState([], [
            { id: 'g1', name: 'group-1', floorId: 'f1', memberIds: [], parentGroupId: null },
        ]);
        const cmd = buildRenameGroupCommand(state, 'g1', 'east-barracks')!;
        cmd.do(state);
        expect(state.groups.get('g1')!.name).toBe('east-barracks');
        cmd.undo(state);
        expect(state.groups.get('g1')!.name).toBe('group-1');
    });
});
