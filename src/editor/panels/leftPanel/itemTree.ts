/**
 * Tree model for the LeftPanel item list.
 *
 * Combines groups (`state.groups`) with per-layer items (`state.byLayer`) into
 * a nested structure renderable as an expand/collapse tree. Groups scoped to
 * the active floor appear at root; their members (nested groups + items on
 * the active layer) indent beneath. Items on the active layer that have no
 * parent group appear at root alongside the groups. Items on other layers
 * inside a group are filtered out; an empty post-filter group still renders.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState, ItemRef } from '../../state/EditorWorkingState';
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

/** Build the tree for the active floor+layer. */
export function buildItemTree(state: EditorWorkingState): TreeNode[] {
    const layerId = state.activeLayerId;
    const floorId = state.activeFloorId;
    if (!layerId || !floorId) return [];

    // Every item id that is a member of some group (at any depth). Used to
    // exclude them from the root list.
    const groupedItemIds = new Set<string>();
    for (const g of state.groups.values()) {
        for (const m of g.memberIds) groupedItemIds.add(m);
    }

    const layerItems = state.byLayer.get(layerId);

    const buildGroup = (group: Group, depth: number): TreeGroupNode => {
        const children: TreeNode[] = [];
        let visibleItemCount = 0;
        for (const mid of group.memberIds) {
            const nested = state.groups.get(mid);
            if (nested) {
                const node = buildGroup(nested, depth + 1);
                children.push(node);
                visibleItemCount += node.visibleItemCount;
                continue;
            }
            const ref = state.byGUID.get(mid);
            if (!ref) continue;
            if (ref.layerId !== layerId) continue;
            children.push({ type: 'item', id: mid, ref, depth: depth + 1 });
            visibleItemCount += 1;
        }
        children.sort(sortNodes);
        return { type: 'group', id: group.id, group, depth, children, visibleItemCount };
    };

    const roots: TreeNode[] = [];

    // Top-level groups on the active floor.
    for (const group of state.groups.values()) {
        if (group.parentGroupId !== null) continue;
        if (group.floorId !== floorId) continue;
        roots.push(buildGroup(group, 0));
    }

    // Ungrouped items on the active layer.
    if (layerItems) {
        for (const id of layerItems) {
            if (groupedItemIds.has(id)) continue;
            const ref = state.byGUID.get(id);
            if (!ref) continue;
            roots.push({ type: 'item', id, ref, depth: 0 });
        }
    }

    roots.sort(sortNodes);
    return roots;
}

function sortNodes(a: TreeNode, b: TreeNode): number {
    // Groups first (stable within kind) then items alphabetical.
    if (a.type !== b.type) return a.type === 'group' ? -1 : 1;
    const an = a.type === 'group' ? a.group.name : a.ref.name;
    const bn = b.type === 'group' ? b.group.name : b.ref.name;
    return an.localeCompare(bn);
}
