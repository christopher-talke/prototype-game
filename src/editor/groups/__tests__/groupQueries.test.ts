import { describe, it, expect } from 'vitest';

import type { EditorWorkingState, ItemRef } from '../../state/EditorWorkingState';
import type { Group } from '../Group';
import {
    findGroupForExactSelection,
    findTopmostGroup,
    groupDepth,
    groupMembersFlattened,
    groupSubtreeDepth,
    parentOf,
    pruneGroupsAgainstItems,
    wouldCreateCycle,
} from '../groupQueries';

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

describe('groupQueries.parentOf', () => {
    it('returns null for an item that belongs to no group', () => {
        const state = mkState([mkItem('a')], []);
        expect(parentOf(state, 'a')).toBe(null);
    });

    it('returns the immediate enclosing group id for a member item', () => {
        const state = mkState([mkItem('a')], [
            { id: 'g1', name: 'group-1', floorId: 'f1', memberIds: ['a'], parentGroupId: null },
        ]);
        expect(parentOf(state, 'a')).toBe('g1');
    });

    it('returns parentGroupId for a nested group', () => {
        const state = mkState([mkItem('a')], [
            { id: 'g1', name: 'group-1', floorId: 'f1', memberIds: ['g2'], parentGroupId: null },
            { id: 'g2', name: 'group-2', floorId: 'f1', memberIds: ['a'], parentGroupId: 'g1' },
        ]);
        expect(parentOf(state, 'g2')).toBe('g1');
    });
});

describe('groupQueries.findTopmostGroup', () => {
    it('returns null when item has no group', () => {
        const state = mkState([mkItem('a')], []);
        expect(findTopmostGroup(state, 'a')).toBe(null);
    });

    it('walks the chain to the top-level ancestor', () => {
        const state = mkState([mkItem('a')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['g2'], parentGroupId: null },
            { id: 'g2', name: 'g2', floorId: 'f1', memberIds: ['a'], parentGroupId: 'g1' },
        ]);
        expect(findTopmostGroup(state, 'a')?.id).toBe('g1');
    });
});

describe('groupQueries.groupMembersFlattened', () => {
    it('returns only item GUIDs, skipping nested group ids', () => {
        const state = mkState([mkItem('a'), mkItem('b'), mkItem('c')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'g2'], parentGroupId: null },
            { id: 'g2', name: 'g2', floorId: 'f1', memberIds: ['b', 'c'], parentGroupId: 'g1' },
        ]);
        const flat = groupMembersFlattened(state, 'g1');
        expect(flat.sort()).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty list for an unknown group id', () => {
        const state = mkState([], []);
        expect(groupMembersFlattened(state, 'missing')).toEqual([]);
    });
});

describe('groupQueries.groupDepth / groupSubtreeDepth', () => {
    it('top-level group has depth 1 and subtree depth 1 (no nesting)', () => {
        const state = mkState([mkItem('a')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a'], parentGroupId: null },
        ]);
        expect(groupDepth(state, 'g1')).toBe(1);
        expect(groupSubtreeDepth(state, 'g1')).toBe(1);
    });

    it('nested group reports correct depth and subtree depth', () => {
        const state = mkState([mkItem('a')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['g2'], parentGroupId: null },
            { id: 'g2', name: 'g2', floorId: 'f1', memberIds: ['a'], parentGroupId: 'g1' },
        ]);
        expect(groupDepth(state, 'g2')).toBe(2);
        expect(groupSubtreeDepth(state, 'g1')).toBe(2);
    });
});

describe('groupQueries.wouldCreateCycle', () => {
    it('returns true when child equals parent (self-parenting)', () => {
        const state = mkState([], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: [], parentGroupId: null },
        ]);
        expect(wouldCreateCycle(state, 'g1', 'g1')).toBe(true);
    });

    it('returns true when parent is a descendant of child (ancestor loop)', () => {
        const state = mkState([], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['g2'], parentGroupId: null },
            { id: 'g2', name: 'g2', floorId: 'f1', memberIds: [], parentGroupId: 'g1' },
        ]);
        expect(wouldCreateCycle(state, 'g1', 'g2')).toBe(true);
    });

    it('returns true when placement would exceed MAX_GROUP_DEPTH', () => {
        const state = mkState([], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['g2'], parentGroupId: null },
            { id: 'g2', name: 'g2', floorId: 'f1', memberIds: ['g3'], parentGroupId: 'g1' },
            { id: 'g3', name: 'g3', floorId: 'f1', memberIds: ['g4'], parentGroupId: 'g2' },
            { id: 'g4', name: 'g4', floorId: 'f1', memberIds: [], parentGroupId: 'g3' },
            { id: 'gX', name: 'gX', floorId: 'f1', memberIds: [], parentGroupId: null },
        ]);
        // Placing gX (subtree 1) under g4 (depth 4) -> total 5 > MAX_GROUP_DEPTH (4).
        expect(wouldCreateCycle(state, 'gX', 'g4')).toBe(true);
    });
});

describe('groupQueries.findGroupForExactSelection', () => {
    it('returns the group whose flattened members match the selection', () => {
        const state = mkState([mkItem('a'), mkItem('b')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b'], parentGroupId: null },
        ]);
        expect(findGroupForExactSelection(state, ['a', 'b'])?.id).toBe('g1');
    });

    it('returns null when selection is a subset', () => {
        const state = mkState([mkItem('a'), mkItem('b')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'b'], parentGroupId: null },
        ]);
        expect(findGroupForExactSelection(state, ['a'])).toBe(null);
    });
});

describe('groupQueries.pruneGroupsAgainstItems', () => {
    it('drops stale member GUIDs', () => {
        const state = mkState([mkItem('a')], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['a', 'ghost'], parentGroupId: null },
        ]);
        pruneGroupsAgainstItems(state);
        expect(state.groups.get('g1')!.memberIds).toEqual(['a']);
    });

    it('auto-dissolves a group that becomes empty', () => {
        const state = mkState([], [
            { id: 'g1', name: 'g1', floorId: 'f1', memberIds: ['ghost'], parentGroupId: null },
        ]);
        pruneGroupsAgainstItems(state);
        expect(state.groups.has('g1')).toBe(false);
    });

    it('reparents orphaned children of a dissolved group to its parent', () => {
        const state = mkState([mkItem('a')], [
            { id: 'gOuter', name: 'outer', floorId: 'f1', memberIds: ['gInner'], parentGroupId: null },
            { id: 'gInner', name: 'inner', floorId: 'f1', memberIds: ['gLeaf'], parentGroupId: 'gOuter' },
            { id: 'gLeaf', name: 'leaf', floorId: 'f1', memberIds: ['a'], parentGroupId: 'gInner' },
        ]);
        // Remove the leaf item so gLeaf auto-dissolves. gInner then becomes empty
        // because gLeaf (its only member) is gone.
        state.byGUID.delete('a');
        pruneGroupsAgainstItems(state);
        expect(state.groups.has('gLeaf')).toBe(false);
        expect(state.groups.has('gInner')).toBe(false);
        // gOuter now has no children and auto-dissolves too.
        expect(state.groups.has('gOuter')).toBe(false);
    });
});
