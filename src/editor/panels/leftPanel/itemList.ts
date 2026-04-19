/**
 * Searchable scrollable item lists for the left panel.
 *
 * `mountItemList` renders a tree of groups + items on the active layer, using
 * `buildItemTree`. Groups are per-floor; members indent under them.
 * `mountKindList` lists all items of specific kinds across the whole map
 * (by byGUID index) -- used for zones, lights, and navHints tabs. It remains
 * flat (groups don't apply to those kinds).
 *
 * Click item row -> select; if item is off-screen, pan camera to it.
 * Click group row -> select all flattened members. Chevron toggles expand.
 * Per-item eye toggles `editorHiddenGUIDs` (runtime-only, not a command);
 * per-group eye cascades to every flattened member.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState, ItemKind, ItemRef } from '../../state/EditorWorkingState';
import type { SelectionStore } from '../../selection/selectionStore';
import type { EditorCamera } from '../../viewport/EditorCamera';
import { boundsOfGUID, unionBounds } from '../../selection/boundsOf';
import { groupMembersFlattened } from '../../groups/groupQueries';
import { buildItemListRow } from './itemListRow';
import { buildItemTree, type TreeGroupNode, type TreeNode } from './itemTree';

export interface ItemListOptions {
    state: EditorWorkingState;
    selection: SelectionStore;
    camera: EditorCamera;
    onHiddenChange: () => void;
}

/** Build the item tree for the active layer. Returns refresh fn. */
export function mountItemList(container: HTMLElement, opts: ItemListOptions): () => void {
    container.innerHTML = '';
    container.classList.add('editor-item-list');

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search items...';
    search.className = 'editor-item-list-search';
    container.appendChild(search);

    const scroll = document.createElement('div');
    scroll.className = 'editor-item-list-scroll';
    container.appendChild(scroll);

    // Ephemeral expand/collapse state, keyed by group id. Default: expanded.
    const collapsed = new Set<string>();

    const refresh = (): void => {
        scroll.innerHTML = '';
        const filter = search.value.trim().toLowerCase();

        const tree = buildItemTree(opts.state);

        for (const node of tree) {
            renderNode(scroll, node, {
                collapsed,
                filter,
                opts,
                refresh,
            });
        }
    };

    search.addEventListener('input', refresh);
    refresh();
    return refresh;
}

interface RenderCtx {
    collapsed: Set<string>;
    filter: string;
    opts: ItemListOptions;
    refresh: () => void;
}

function renderNode(host: HTMLElement, node: TreeNode, ctx: RenderCtx): void {
    if (node.type === 'group') {
        renderGroupNode(host, node, ctx);
        return;
    }
    if (ctx.filter && !matchesFilter(node.ref, ctx.filter)) return;
    const row = buildItemRow(node.ref, node.depth, ctx);
    host.appendChild(row);
}

function renderGroupNode(host: HTMLElement, node: TreeGroupNode, ctx: RenderCtx): void {
    const isCollapsed = ctx.collapsed.has(node.id);
    const flatMembers = groupMembersFlattened(ctx.opts.state, node.id);

    const allHidden = flatMembers.length > 0
        && flatMembers.every((g) => ctx.opts.state.editorHiddenGUIDs.has(g));
    const allSelected = flatMembers.length > 0
        && flatMembers.every((g) => ctx.opts.selection.has(g));

    const row = document.createElement('div');
    row.className = 'editor-item-row editor-group-row';
    if (allSelected) row.classList.add('selected');
    if (allHidden) row.classList.add('hidden');
    row.style.paddingLeft = `${node.depth * 12}px`;

    const chevron = document.createElement('button');
    chevron.type = 'button';
    chevron.className = 'editor-group-chevron';
    chevron.textContent = isCollapsed ? '>' : 'v';
    chevron.title = isCollapsed ? 'Expand' : 'Collapse';
    chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCollapsed) ctx.collapsed.delete(node.id);
        else ctx.collapsed.add(node.id);
        ctx.refresh();
    });
    row.appendChild(chevron);

    const icon = document.createElement('span');
    icon.className = 'editor-item-icon editor-group-icon';
    icon.textContent = 'G';
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'editor-item-name';
    name.textContent = node.group.name;
    row.appendChild(name);

    const badge = document.createElement('span');
    badge.className = 'editor-group-count';
    badge.textContent = `${node.visibleItemCount}`;
    badge.title = `${flatMembers.length} total members`;
    row.appendChild(badge);

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'editor-item-eye';
    eye.title = allHidden ? 'Show group' : 'Hide group';
    eye.textContent = allHidden ? '-' : 'O';
    eye.addEventListener('click', (e) => {
        e.stopPropagation();
        if (allHidden) {
            for (const g of flatMembers) ctx.opts.state.editorHiddenGUIDs.delete(g);
        } else {
            for (const g of flatMembers) ctx.opts.state.editorHiddenGUIDs.add(g);
        }
        ctx.opts.onHiddenChange();
        ctx.refresh();
    });
    row.appendChild(eye);

    row.addEventListener('click', () => {
        if (flatMembers.length === 0) return;
        ctx.opts.selection.selectMany(flatMembers);
        const aabb = unionBounds(ctx.opts.state, flatMembers);
        if (aabb.width > 0 || aabb.height > 0) {
            panToIfOffscreenBounds(ctx.opts.camera, aabb);
        }
    });

    host.appendChild(row);

    if (isCollapsed) return;
    for (const child of node.children) {
        renderNode(host, child, ctx);
    }
}

function buildItemRow(ref: ItemRef, depth: number, ctx: RenderCtx): HTMLElement {
    const row = buildItemListRow({
        item: ref,
        isSelected: ctx.opts.selection.has(ref.guid),
        isHidden: ctx.opts.state.editorHiddenGUIDs.has(ref.guid),
        onSelect: () => {
            ctx.opts.selection.select(ref.guid);
            panToIfOffscreen(ctx.opts.state, ctx.opts.camera, ref.guid);
        },
        onToggleVisibility: () => {
            if (ctx.opts.state.editorHiddenGUIDs.has(ref.guid)) {
                ctx.opts.state.editorHiddenGUIDs.delete(ref.guid);
            } else {
                ctx.opts.state.editorHiddenGUIDs.add(ref.guid);
            }
            ctx.opts.onHiddenChange();
            ctx.refresh();
        },
    });
    row.style.paddingLeft = `${depth * 12}px`;
    return row;
}

/** Build a kind-filtered list (zones, lights, navHints). Returns refresh fn. */
export function mountKindList(
    container: HTMLElement,
    kinds: ItemKind[],
    opts: ItemListOptions,
): () => void {
    container.innerHTML = '';
    container.classList.add('editor-item-list');
    const kindSet = new Set<ItemKind>(kinds);

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search...';
    search.className = 'editor-item-list-search';
    container.appendChild(search);

    const scroll = document.createElement('div');
    scroll.className = 'editor-item-list-scroll';
    container.appendChild(scroll);

    const refresh = (): void => {
        scroll.innerHTML = '';
        const filter = search.value.trim().toLowerCase();

        const items: ItemRef[] = [];
        for (const ref of opts.state.byGUID.values()) {
            if (kindSet.has(ref.kind)) items.push(ref);
        }
        items.sort((a, b) => a.name.localeCompare(b.name));

        for (const ref of items) {
            if (filter && !matchesFilter(ref, filter)) continue;
            const row = buildItemListRow({
                item: ref,
                isSelected: opts.selection.has(ref.guid),
                isHidden: opts.state.editorHiddenGUIDs.has(ref.guid),
                onSelect: () => {
                    opts.selection.select(ref.guid);
                    panToIfOffscreen(opts.state, opts.camera, ref.guid);
                },
                onToggleVisibility: () => {
                    if (opts.state.editorHiddenGUIDs.has(ref.guid)) {
                        opts.state.editorHiddenGUIDs.delete(ref.guid);
                    } else {
                        opts.state.editorHiddenGUIDs.add(ref.guid);
                    }
                    opts.onHiddenChange();
                    refresh();
                },
            });
            scroll.appendChild(row);
        }
    };

    search.addEventListener('input', refresh);
    refresh();
    return refresh;
}

function matchesFilter(ref: ItemRef, filter: string): boolean {
    return ref.name.toLowerCase().includes(filter) || ref.kind.toLowerCase().includes(filter);
}

function panToIfOffscreen(
    state: EditorWorkingState,
    camera: EditorCamera,
    guid: string,
): void {
    const aabb = boundsOfGUID(state, guid);
    if (aabb.width === 0 && aabb.height === 0) return;
    panToIfOffscreenBounds(camera, aabb);
}

function panToIfOffscreenBounds(
    camera: EditorCamera,
    aabb: { x: number; y: number; width: number; height: number },
): void {
    const vp = camera.getViewportSize();
    const left = camera.x;
    const top = camera.y;
    const right = left + vp.width / camera.zoom;
    const bottom = top + vp.height / camera.zoom;

    const cx = aabb.x + aabb.width / 2;
    const cy = aabb.y + aabb.height / 2;

    if (cx < left || cx > right || cy < top || cy > bottom) {
        camera.centerOn(cx, cy);
    }
}
