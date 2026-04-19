/**
 * Pure query helpers over `state.groups`.
 *
 * None of these mutate state. Commands call the mutators directly and use
 * these helpers for pre-flight checks and selection resolution.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { MAX_GROUP_DEPTH, type Group } from './Group';

/**
 * Walk up the parent chain from `id` (group or item) and return the top-most
 * enclosing group, or null if `id` has no parent group.
 */
export function findTopmostGroup(state: EditorWorkingState, id: string): Group | null {
    let currentParentId = parentOf(state, id);
    let top: Group | null = null;
    while (currentParentId) {
        const g = state.groups.get(currentParentId);
        if (!g) return top;
        top = g;
        currentParentId = g.parentGroupId;
    }
    return top;
}

/**
 * Walk up the parent chain from `id`; return the immediate-parent group id
 * if any, else null. Works for both item GUIDs and nested group ids.
 */
export function parentOf(state: EditorWorkingState, id: string): string | null {
    if (state.groups.has(id)) return state.groups.get(id)!.parentGroupId;
    for (const group of state.groups.values()) {
        if (group.memberIds.includes(id)) return group.id;
    }
    return null;
}

/**
 * Flatten a group's membership tree to the set of underlying item GUIDs
 * (skipping nested group ids). Used to translate a group selection into
 * the flat set of items SelectionStore holds.
 */
export function groupMembersFlattened(state: EditorWorkingState, groupId: string): string[] {
    const out: string[] = [];
    const visit = (gid: string): void => {
        const g = state.groups.get(gid);
        if (!g) return;
        for (const m of g.memberIds) {
            if (state.groups.has(m)) visit(m);
            else if (state.byGUID.has(m)) out.push(m);
        }
    };
    visit(groupId);
    return out;
}

/** Depth of `groupId` from the top (top-level groups have depth 1). */
export function groupDepth(state: EditorWorkingState, groupId: string): number {
    let depth = 0;
    let cur: string | null = groupId;
    while (cur) {
        const g = state.groups.get(cur);
        if (!g) break;
        depth += 1;
        cur = g.parentGroupId;
    }
    return depth;
}

/** Max depth reached in the subtree rooted at `groupId`. Leaves contribute depth 1. */
export function groupSubtreeDepth(state: EditorWorkingState, groupId: string): number {
    const g = state.groups.get(groupId);
    if (!g) return 0;
    let max = 1;
    for (const m of g.memberIds) {
        if (state.groups.has(m)) {
            const d = 1 + groupSubtreeDepth(state, m);
            if (d > max) max = d;
        }
    }
    return max;
}

/**
 * True if reparenting `candidateChildId` under `candidateParentId` would
 * create a cycle or exceed `MAX_GROUP_DEPTH`. Both arguments must be group
 * ids.
 */
export function wouldCreateCycle(
    state: EditorWorkingState,
    candidateChildId: string,
    candidateParentId: string,
): boolean {
    if (candidateChildId === candidateParentId) return true;
    let cur: string | null = candidateParentId;
    while (cur) {
        if (cur === candidateChildId) return true;
        const g = state.groups.get(cur);
        if (!g) break;
        cur = g.parentGroupId;
    }
    const childSubtree = groupSubtreeDepth(state, candidateChildId);
    const parentDepth = groupDepth(state, candidateParentId);
    return parentDepth + childSubtree > MAX_GROUP_DEPTH;
}

/** True when the given set is exactly the flattened membership of some group. */
export function findGroupForExactSelection(
    state: EditorWorkingState,
    selectedGuids: readonly string[],
): Group | null {
    if (selectedGuids.length === 0) return null;
    const selectedSet = new Set(selectedGuids);
    for (const g of state.groups.values()) {
        const flat = groupMembersFlattened(state, g.id);
        if (flat.length !== selectedSet.size) continue;
        let match = true;
        for (const guid of flat) {
            if (!selectedSet.has(guid)) { match = false; break; }
        }
        if (match) return g;
    }
    return null;
}

/**
 * Drop item GUIDs from every group's `memberIds` that no longer exist in
 * `state.byGUID`. Auto-dissolve any group that becomes empty. Called after
 * structural map changes that may have deleted items (undo, redo, delete
 * commands).
 */
export function pruneGroupsAgainstItems(state: EditorWorkingState): void {
    // First sweep: drop stale item references.
    for (const g of state.groups.values()) {
        const kept: string[] = [];
        for (const m of g.memberIds) {
            if (state.groups.has(m) || state.byGUID.has(m)) kept.push(m);
        }
        g.memberIds = kept;
    }
    // Cascade-dissolve empty groups until none remain. A dissolve can empty a
    // parent whose only member was the just-dissolved child; loop to fixed
    // point.
    let dissolvedSomething = true;
    while (dissolvedSomething) {
        dissolvedSomething = false;
        for (const g of [...state.groups.values()]) {
            if (g.memberIds.length === 0) {
                dissolveGroupInPlace(state, g.id);
                dissolvedSomething = true;
            }
        }
    }
}

/**
 * In-place dissolve used by the prune helper. Removes the group, reparents
 * its children to its parent (or top-level if none). Does NOT go through
 * the command stack.
 */
function dissolveGroupInPlace(state: EditorWorkingState, groupId: string): void {
    const g = state.groups.get(groupId);
    if (!g) return;
    const parent = g.parentGroupId ? state.groups.get(g.parentGroupId) ?? null : null;
    if (parent) {
        const idx = parent.memberIds.indexOf(groupId);
        if (idx >= 0) parent.memberIds.splice(idx, 1, ...g.memberIds);
    }
    for (const m of g.memberIds) {
        if (state.groups.has(m)) {
            state.groups.get(m)!.parentGroupId = parent ? parent.id : null;
        }
    }
    state.groups.delete(groupId);
}
