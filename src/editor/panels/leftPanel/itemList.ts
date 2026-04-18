/**
 * Searchable scrollable item lists for the left panel.
 *
 * `mountItemList` lists items on the active layer (by byLayer index).
 * `mountKindList` lists all items of specific kinds across the whole map
 * (by byGUID index) -- used for zones, lights, and navHints tabs.
 *
 * Click row -> select; if item is off-screen, pan camera to it. Per-item
 * eye toggles `editorHiddenGUIDs` (runtime-only, not a command).
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState, ItemKind, ItemRef } from '../../state/EditorWorkingState';
import type { SelectionStore } from '../../selection/selectionStore';
import type { EditorCamera } from '../../viewport/EditorCamera';
import { boundsOfGUID } from '../../selection/boundsOf';
import { buildItemListRow } from './itemListRow';

export interface ItemListOptions {
    state: EditorWorkingState;
    selection: SelectionStore;
    camera: EditorCamera;
    onHiddenChange: () => void;
}

/** Build the item list. Returns refresh fn. */
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

    const refresh = (): void => {
        scroll.innerHTML = '';
        const filter = search.value.trim().toLowerCase();
        const layerId = opts.state.activeLayerId;
        if (!layerId) return;

        const ids = opts.state.byLayer.get(layerId);
        if (!ids) return;

        const items: ItemRef[] = [];
        for (const id of ids) {
            const ref = opts.state.byGUID.get(id);
            if (!ref) continue;
            items.push(ref);
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
