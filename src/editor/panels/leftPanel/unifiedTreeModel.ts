/**
 * Pure model layer for the unified tree. Builds row lists per section from
 * `EditorWorkingState` without touching the DOM. Consumed by `unifiedTree.ts`
 * for rendering and by tests directly.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState, ItemKind, ItemRef } from '../../state/EditorWorkingState';
import { buildItemTree, type TreeGroupNode, type TreeNode } from './itemTree';

export interface SectionDef {
    id: string;
    title: string;
    kinds: ItemKind[];
    /** When true, list items on the active floor ignoring layer (zones). */
    floorScoped?: boolean;
    /** When true, ignore floor/layer filters entirely (navHints). */
    global?: boolean;
}

export interface RowEntry {
    kind: 'item' | 'group';
    ref: ItemRef | null;
    depth: number;
    groupId: string | null;
    groupLabel: string | null;
}

export const ITEM_SECTIONS: SectionDef[] = [
    { id: 'walls', title: 'Walls', kinds: ['wall'] },
    { id: 'zones', title: 'Zones', kinds: ['zone'], floorScoped: true },
    { id: 'objects', title: 'Objects', kinds: ['object'] },
    { id: 'entities', title: 'Entities', kinds: ['entity'] },
    { id: 'lights', title: 'Lights', kinds: ['light'] },
    { id: 'decals', title: 'Decals', kinds: ['decal'] },
    { id: 'nav', title: 'Nav Hints', kinds: ['navHint'], global: true },
];

/**
 * Case-insensitive substring match on the item's display name or the first
 * 8 chars of its guid. Empty filter matches everything.
 */
export function matchesFilter(ref: ItemRef, filter: string): boolean {
    if (!filter) return true;
    const lower = filter.toLowerCase();
    if (ref.name.toLowerCase().includes(lower)) return true;
    if (ref.guid.slice(0, 8).toLowerCase().includes(lower)) return true;
    return false;
}

/**
 * Build the row list for a single section. Handles the three layering modes
 * (global, floor-scoped, layer-scoped with groups).
 */
export function collectSectionRows(
    state: EditorWorkingState,
    def: SectionDef,
    filter: string,
): RowEntry[] {
    const kindSet = new Set<ItemKind>(def.kinds);

    if (def.global) {
        const out: RowEntry[] = [];
        for (const ref of state.byGUID.values()) {
            if (!kindSet.has(ref.kind)) continue;
            if (!matchesFilter(ref, filter)) continue;
            out.push({ kind: 'item', ref, depth: 0, groupId: null, groupLabel: null });
        }
        // Preserve map-array order (byGUID insertion order matches map.navHints order).
        return out;
    }

    if (def.floorScoped) {
        const out: RowEntry[] = [];
        for (const ref of state.byGUID.values()) {
            if (!kindSet.has(ref.kind)) continue;
            if (ref.floorId && ref.floorId !== state.activeFloorId) continue;
            if (!matchesFilter(ref, filter)) continue;
            out.push({ kind: 'item', ref, depth: 0, groupId: null, groupLabel: null });
        }
        // Preserve map-array order (byGUID insertion order matches map.zones order).
        return out;
    }

    const tree = buildItemTree(state, kindSet);
    const out: RowEntry[] = [];
    const walk = (node: TreeNode): void => {
        if (node.type === 'group') {
            if (filter && !groupHasMatch(node, filter)) return;
            out.push({
                kind: 'group',
                ref: null,
                depth: node.depth,
                groupId: node.id,
                groupLabel: node.group.name,
            });
            for (const child of node.children) walk(child);
            return;
        }
        if (!matchesFilter(node.ref, filter)) return;
        out.push({ kind: 'item', ref: node.ref, depth: node.depth, groupId: null, groupLabel: null });
    };
    for (const node of tree) walk(node);
    return out;
}

function groupHasMatch(node: TreeGroupNode, filter: string): boolean {
    for (const c of node.children) {
        if (c.type === 'item') {
            if (matchesFilter(c.ref, filter)) return true;
        } else if (groupHasMatch(c, filter)) {
            return true;
        }
    }
    return false;
}

export interface SectionFlagState {
    anyVisible: boolean;
    allHidden: boolean;
    anyUnlocked: boolean;
    allLocked: boolean;
    empty: boolean;
}

/**
 * Resolve aggregate hidden/locked state across every item in a section.
 * Drives the section-header eye + padlock tri-state buttons.
 */
export function collectSectionFlagState(
    state: EditorWorkingState,
    def: SectionDef,
): SectionFlagState {
    const kindSet = new Set<ItemKind>(def.kinds);
    let any = false;
    let anyVisible = false;
    let allHidden = true;
    let anyUnlocked = false;
    let allLocked = true;
    for (const ref of state.byGUID.values()) {
        if (!kindSet.has(ref.kind)) continue;
        if (def.floorScoped) {
            if (ref.floorId && ref.floorId !== state.activeFloorId) continue;
        } else if (!def.global) {
            if (ref.layerId && ref.layerId !== state.activeLayerId) continue;
        }
        any = true;
        const item = findItem(state, ref.guid);
        const hidden = (item as { hidden?: boolean } | null)?.hidden === true;
        const locked = (item as { locked?: boolean } | null)?.locked === true;
        if (!hidden) anyVisible = true;
        if (hidden === false) allHidden = false;
        if (!locked) anyUnlocked = true;
        if (!locked) allLocked = false;
    }
    if (!any) {
        return { anyVisible: false, allHidden: false, anyUnlocked: false, allLocked: false, empty: true };
    }
    return { anyVisible, allHidden, anyUnlocked, allLocked, empty: false };
}

function findItem(state: EditorWorkingState, guid: string): unknown {
    for (const layer of state.map.layers) {
        const w = layer.walls.find((x) => x.id === guid);
        if (w) return w;
        const o = layer.objects.find((x) => x.id === guid);
        if (o) return o;
        const e = layer.entities.find((x) => x.id === guid);
        if (e) return e;
        const d = layer.decals.find((x) => x.id === guid);
        if (d) return d;
        const l = layer.lights.find((x) => x.id === guid);
        if (l) return l;
    }
    const z = state.map.zones.find((x) => x.id === guid);
    if (z) return z;
    const n = state.map.navHints.find((x) => x.id === guid);
    if (n) return n;
    return null;
}

/**
 * Resolve a section's effective collapse state. A non-empty filter forces the
 * section open; otherwise uses the persisted flag (or `defaultCollapsed` when
 * the section has no stored entry).
 */
export function resolveSectionCollapsed(
    persisted: Record<string, boolean>,
    sectionId: string,
    defaultCollapsed: boolean,
    filtered: boolean,
): boolean {
    if (filtered) return false;
    const stored = persisted[sectionId];
    if (stored === undefined) return defaultCollapsed;
    return stored;
}
