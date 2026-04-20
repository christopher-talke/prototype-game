/**
 * Build the per-context menu structures.
 *
 * Three contexts:
 *  - itemMenu(state, selection): right-click on a (selected) item
 *  - emptyMenu(state, selection): right-click on empty space
 *  - layerMenu(state, layerId): right-click on a layer row in the LeftPanel
 *
 * The actions dispatch commands or call clipboard helpers; all wiring is
 * supplied by the caller via `EditorActions`.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { SelectionStore } from '../selection/selectionStore';
import type { Vec2 } from '@shared/map/MapData';
import type { MenuItem } from './contextMenu';
import { hasClipboard } from '../clipboard/clipboard';
import { KIND_ICON } from '../panels/leftPanel/itemListRow';

export interface EditorActions {
    cut(): void;
    copy(): void;
    paste(targetCentre: Vec2): void;
    duplicate(): void;
    deleteSelection(): void;
    selectAll(): void;
    moveToLayer(layerId: string): void;
    toggleLayerLock(): void;
    openProperties(): void;
}

/**
 * Build a MenuItem list for the "Select From Here" submenu, one entry per hit.
 * Each entry shows a kind-badge prefix and the ref's display name; clicking it
 * replaces the current selection with that GUID.
 */
export function buildSelectFromHereSubmenu(
    state: EditorWorkingState,
    selection: SelectionStore,
    hits: string[],
): MenuItem[] {
    const out: MenuItem[] = [];
    for (const guid of hits) {
        const ref = state.byGUID.get(guid);
        if (!ref) continue;
        const badge = KIND_ICON[ref.kind] ?? '?';
        out.push({
            label: `${badge}  ${ref.name}`,
            onClick: () => selection.select(guid),
        });
    }
    return out;
}

/** Menu for right-click on a selected item. */
export function itemMenu(
    state: EditorWorkingState,
    selection: SelectionStore,
    actions: EditorActions,
    targetCentre: Vec2,
    selectFromHere?: MenuItem[],
): MenuItem[] {
    const hasSel = !selection.isEmpty();
    const otherLayers = state.map.layers.filter((l) => l.floorId === state.activeFloorId);
    const submoves: MenuItem[] = otherLayers.map((l) => ({
        label: `${l.label}`,
        enabled: l.id !== state.activeLayerId && hasSel,
        onClick: () => actions.moveToLayer(l.id),
    }));

    const base: MenuItem[] = [
        { label: 'Cut', shortcut: 'Ctrl+X', enabled: hasSel, onClick: () => actions.cut() },
        { label: 'Copy', shortcut: 'Ctrl+C', enabled: hasSel, onClick: () => actions.copy() },
        { label: 'Paste', shortcut: 'Ctrl+V', enabled: hasClipboard(), onClick: () => actions.paste(targetCentre) },
        { label: 'Duplicate', shortcut: 'Ctrl+D', enabled: hasSel, onClick: () => actions.duplicate() },
        { separator: true, label: '' },
        { label: 'Delete', shortcut: 'Del', enabled: hasSel, onClick: () => actions.deleteSelection() },
        { separator: true, label: '' },
        { label: 'Move to Layer', enabled: hasSel && submoves.length > 0, submenu: submoves },
        { label: 'Lock / Unlock Layer', onClick: () => actions.toggleLayerLock() },
        { separator: true, label: '' },
        { label: 'Properties...', enabled: hasSel, onClick: () => actions.openProperties() },
    ];

    if (selectFromHere && selectFromHere.length > 0) {
        return [
            { label: 'Select From Here', submenu: selectFromHere },
            { separator: true, label: '' },
            ...base,
        ];
    }
    return base;
}

/** Menu for right-click on empty viewport space. */
export function emptyMenu(
    actions: EditorActions,
    targetCentre: Vec2,
    selectFromHere?: MenuItem[],
): MenuItem[] {
    const base: MenuItem[] = [
        { label: 'Paste', shortcut: 'Ctrl+V', enabled: hasClipboard(), onClick: () => actions.paste(targetCentre) },
        { separator: true, label: '' },
        { label: 'Select All', shortcut: 'Ctrl+A', onClick: () => actions.selectAll() },
    ];

    if (selectFromHere && selectFromHere.length > 0) {
        return [
            { label: 'Select From Here', submenu: selectFromHere },
            { separator: true, label: '' },
            ...base,
        ];
    }
    return base;
}
