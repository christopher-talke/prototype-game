/**
 * Selection breadcrumb for the left panel. Renders a single-line path showing
 * the current selection's floor, section, and display name. Subscribes to the
 * selection store and refreshes in place.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState, ItemKind, ItemRef } from '../../state/EditorWorkingState';
import type { SelectionStore } from '../../selection/selectionStore';

const SECTION_LABELS: Record<ItemKind, string> = {
    wall: 'Walls',
    object: 'Objects',
    entity: 'Entities',
    decal: 'Decals',
    light: 'Lights',
    zone: 'Zones',
    navHint: 'Nav Hints',
};

const SEPARATOR = ' \u203A ';

export interface BreadcrumbOptions {
    state: EditorWorkingState;
    selection: SelectionStore;
}

/**
 * Compute the breadcrumb string for the given selection. Returns an empty
 * string when nothing is selected. Used by the DOM helper and tested directly.
 */
export function composeBreadcrumb(state: EditorWorkingState, guids: string[]): string {
    if (guids.length === 0) return '';
    if (guids.length > 1) return `${guids.length} items selected`;

    const ref = state.byGUID.get(guids[0]);
    if (!ref) return '';

    const section = SECTION_LABELS[ref.kind] ?? '';

    if (ref.kind === 'navHint') {
        return [section, ref.name].filter(Boolean).join(SEPARATOR);
    }

    const floorId = ref.floorId ?? floorIdForRef(state, ref);
    const floorLabel = floorId
        ? state.map.floors.find((f) => f.id === floorId)?.label
        : undefined;

    const parts: string[] = [];
    if (floorLabel) parts.push(`Floor ${floorLabel}`);
    if (section) parts.push(section);
    parts.push(ref.name);
    return parts.join(SEPARATOR);
}

function floorIdForRef(state: EditorWorkingState, ref: ItemRef): string | undefined {
    if (ref.kind === 'zone') {
        const z = state.map.zones.find((x) => x.id === ref.guid);
        return z?.floorId;
    }
    if (ref.layerId) {
        const layer = state.map.layers.find((l) => l.id === ref.layerId);
        return layer?.floorId;
    }
    return undefined;
}

/**
 * Mount a breadcrumb element into `container` and subscribe to the selection
 * store. Returns a dispose function.
 */
export function mountBreadcrumb(container: HTMLElement, opts: BreadcrumbOptions): () => void {
    const el = document.createElement('div');
    el.className = 'editor-left-breadcrumb';
    container.appendChild(el);

    const refresh = (): void => {
        const guids = opts.selection.selectedArray();
        el.textContent = composeBreadcrumb(opts.state, guids);
    };

    const unsubscribe = opts.selection.subscribe(refresh);
    refresh();

    return () => {
        unsubscribe();
        el.remove();
    };
}
