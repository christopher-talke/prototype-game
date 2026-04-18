/**
 * Single row in the item list. Type icon + display name + per-item eye toggle.
 *
 * Per-item visibility is runtime-only (toggles `editorHiddenGUIDs`).
 *
 * Part of the editor layer.
 */

import type { ItemRef } from '../../state/EditorWorkingState';

export interface ItemListRowOptions {
    item: ItemRef;
    isSelected: boolean;
    isHidden: boolean;
    onSelect: () => void;
    onToggleVisibility: () => void;
}

const KIND_ICON: Record<string, string> = {
    wall: 'W',
    object: 'O',
    entity: 'E',
    decal: 'D',
    light: 'L',
    zone: 'Z',
    navHint: 'N',
};

/** Build an item row element. */
export function buildItemListRow(opts: ItemListRowOptions): HTMLElement {
    const row = document.createElement('div');
    row.className = 'editor-item-row';
    if (opts.isSelected) row.classList.add('selected');
    if (opts.isHidden) row.classList.add('hidden');

    const icon = document.createElement('span');
    icon.className = 'editor-item-icon';
    icon.textContent = KIND_ICON[opts.item.kind] ?? '?';
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'editor-item-name';
    name.textContent = opts.item.name;
    row.appendChild(name);

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'editor-item-eye';
    eye.title = opts.isHidden ? 'Show item' : 'Hide item';
    eye.textContent = opts.isHidden ? '-' : 'O';
    eye.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onToggleVisibility();
    });
    row.appendChild(eye);

    row.addEventListener('click', () => opts.onSelect());

    return row;
}
