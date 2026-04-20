/**
 * Single row in the item tree. Type icon + display name + per-item eye and
 * padlock toggles. Row click selects; dblclick on the name begins an inline
 * rename. A `data-guid` attribute lets external code (F2 hotkey) find the
 * active row.
 *
 * Part of the editor layer.
 */

import type { ItemRef } from '../../state/EditorWorkingState';
import { beginInlineRename } from './inlineRename';

export interface ItemListRowOptions {
    item: ItemRef;
    isSelected: boolean;
    isHidden: boolean;
    isLocked: boolean;
    onSelect: (e: MouseEvent) => void;
    onToggleVisibility: () => void;
    onToggleLock: () => void;
    /** Optional: called when the user double-clicks the row name to rename. */
    onBeginRename?: (commit: (next: string) => void) => void;
    /** Optional: commits the new label. Passed into `onBeginRename` when both provided. */
    onRename?: (next: string) => void;
    /** Optional: when filter is non-empty, highlight matches in the name. */
    filter?: string;
}

export const KIND_ICON: Record<string, string> = {
    wall: 'W',
    object: 'O',
    entity: 'E',
    decal: 'D',
    light: 'L',
    zone: 'Z',
    navHint: 'N',
};

export interface ItemListRowHandle {
    readonly el: HTMLElement;
    beginRename: () => void;
}

/** Build an item row element. Returns the element plus a rename handle. */
export function buildItemListRow(opts: ItemListRowOptions): ItemListRowHandle {
    const row = document.createElement('div');
    row.className = 'editor-item-row';
    row.dataset.guid = opts.item.guid;
    if (opts.isSelected) row.classList.add('selected');
    if (opts.isHidden) row.classList.add('hidden');
    if (opts.isLocked) row.classList.add('locked');

    const icon = document.createElement('span');
    icon.className = 'editor-item-icon';
    icon.textContent = KIND_ICON[opts.item.kind] ?? '?';
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'editor-item-name';
    renderHighlightedText(name, opts.item.name, opts.filter ?? '');
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

    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'editor-item-lock';
    lock.title = opts.isLocked ? 'Unlock item' : 'Lock item';
    lock.textContent = opts.isLocked ? 'L' : 'U';
    lock.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onToggleLock();
    });
    row.appendChild(lock);

    row.addEventListener('click', (e) => opts.onSelect(e));

    const beginRename = (): void => {
        if (!opts.onRename) return;
        beginInlineRename(name, opts.item.name, opts.onRename);
    };

    if (opts.onRename) {
        name.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            beginRename();
        });
    }

    return { el: row, beginRename };
}

/**
 * Render `text` into `target`, wrapping the first case-insensitive match of
 * `filter` in a `<mark>` element. DOM-only (no innerHTML).
 */
export function renderHighlightedText(target: HTMLElement, text: string, filter: string): void {
    target.textContent = '';
    if (!filter) {
        target.appendChild(document.createTextNode(text));
        return;
    }
    const idx = text.toLowerCase().indexOf(filter.toLowerCase());
    if (idx < 0) {
        target.appendChild(document.createTextNode(text));
        return;
    }
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + filter.length);
    const after = text.slice(idx + filter.length);
    if (before) target.appendChild(document.createTextNode(before));
    const mark = document.createElement('mark');
    mark.textContent = match;
    target.appendChild(mark);
    if (after) target.appendChild(document.createTextNode(after));
}
