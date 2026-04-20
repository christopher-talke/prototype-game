/**
 * Tree model for the LeftPanel item list.
 *
 * Combines groups (`state.groups`) with per-layer items (`state.byLayer`) into
 * a nested structure renderable as an expand/collapse tree. Groups scoped to
 * the active floor appear at root; their members (nested groups + items on
 * the active layer, filtered by kind) indent beneath. Items on the active
 * layer that have no parent group appear at root alongside the groups. Items
 * on other layers inside a group are filtered out; a group with no surviving
 * descendants is omitted.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState, ItemKind, ItemRef } from '../../state/EditorWorkingState';
import type { Group } from '../../groups/Group';

export interface TreeItemNode {
    type: 'item';
    id: string;
    ref: ItemRef;
    depth: number;
}

export interface TreeGroupNode {
    type: 'group';
    id: string;
    group: Group;
    depth: number;
    children: TreeNode[];
    /** Count of flat-item descendants currently visible under this group. */
    visibleItemCount: number;
}

export type TreeNode = TreeItemNode | TreeGroupNode;

/**
 * Build the tree for the active floor+layer, optionally filtered to a subset
 * of kinds. Items whose kind is not in `kindFilter` are excluded (and groups
 * containing only excluded items collapse away). Pass `null` to include
 * every kind.
 */
export function buildItemTree(
    state: EditorWorkingState,
    kindFilter: Set<ItemKind> | null = null,
): TreeNode[] {
    const layerId = state.activeLayerId;
    const floorId = state.activeFloorId;
    if (!layerId || !floorId) return [];

    const groupedItemIds = new Set<string>();
    for (const g of state.groups.values()) {
        for (const m of g.memberIds) groupedItemIds.add(m);
    }

    const layerItems = state.byLayer.get(layerId);

    const kindMatches = (ref: ItemRef): boolean =>
        kindFilter === null || kindFilter.has(ref.kind);

    const buildGroup = (group: Group, depth: number): TreeGroupNode => {
        const children: TreeNode[] = [];
        let visibleItemCount = 0;
        for (const mid of group.memberIds) {
            const nested = state.groups.get(mid);
            if (nested) {
                const node = buildGroup(nested, depth + 1);
                if (node.visibleItemCount === 0) continue;
                children.push(node);
                visibleItemCount += node.visibleItemCount;
                continue;
            }
            const ref = state.byGUID.get(mid);
            if (!ref) continue;
            if (ref.layerId !== layerId) continue;
            if (!kindMatches(ref)) continue;
            children.push({ type: 'item', id: mid, ref, depth: depth + 1 });
            visibleItemCount += 1;
        }
        // Children preserve memberIds order — do not sort.
        return { type: 'group', id: group.id, group, depth, children, visibleItemCount };
    };

    // Top-level groups sorted by name (no positional ordering model for root groups).
    const groupRoots: TreeGroupNode[] = [];
    for (const group of state.groups.values()) {
        if (group.parentGroupId !== null) continue;
        if (group.floorId !== floorId) continue;
        const node = buildGroup(group, 0);
        if (node.visibleItemCount === 0) continue;
        groupRoots.push(node);
    }
    groupRoots.sort((a, b) => a.group.name.localeCompare(b.group.name));

    // Ungrouped items in backing-array order (Set insertion order matches map array order).
    const itemRoots: TreeItemNode[] = [];
    if (layerItems) {
        for (const id of layerItems) {
            if (groupedItemIds.has(id)) continue;
            const ref = state.byGUID.get(id);
            if (!ref) continue;
            if (!kindMatches(ref)) continue;
            itemRoots.push({ type: 'item', id, ref, depth: 0 });
        }
    }

    return [...groupRoots, ...itemRoots];
}

