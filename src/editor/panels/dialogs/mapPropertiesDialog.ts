/**
 * Map Properties modal dialog. Edits meta fields: name, author, player count.
 * Commits changes via a SnapshotCommand dispatched through the caller.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorCommand } from '../../commands/EditorCommand';
import { buildSetMapMetaCommand } from '../../commands/setMapMetaCommand';
import type { EditorWorkingState } from '../../state/EditorWorkingState';

/** Open the Map Properties modal. Calls `onDispatch` if the user saves. */
export function openMapPropertiesDialog(
    state: EditorWorkingState,
    onDispatch: (cmd: EditorCommand) => void,
): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'editor-modal-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'editor-modal';
    backdrop.appendChild(modal);

    const title = document.createElement('div');
    title.className = 'editor-modal-title';
    title.textContent = 'Map Properties';
    modal.appendChild(title);

    const body = document.createElement('div');
    body.className = 'editor-modal-body';
    modal.appendChild(body);

    const meta = state.map.meta;

    const nameInput = addField(body, 'Map Name', meta.name, 'text');
    const authorInput = addField(body, 'Author', meta.author, 'text');
    const minInput = addField(body, 'Player Count (min)', String(meta.playerCount.min), 'number');
    const recInput = addField(body, 'Recommended', String(meta.playerCount.recommended), 'number');
    const maxInput = addField(body, 'Player Count (max)', String(meta.playerCount.max), 'number');

    const footer = document.createElement('div');
    footer.className = 'editor-modal-footer';
    modal.appendChild(footer);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'editor-modal-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    footer.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'editor-modal-btn primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        const patch: Partial<MapData['meta']> = {
            name: nameInput.value.trim() || meta.name,
            author: authorInput.value.trim(),
            playerCount: {
                min: parseInt(minInput.value, 10) || meta.playerCount.min,
                recommended: parseInt(recInput.value, 10) || meta.playerCount.recommended,
                max: parseInt(maxInput.value, 10) || meta.playerCount.max,
            },
        };
        const cmd = buildSetMapMetaCommand(state, patch);
        if (cmd) onDispatch(cmd);
        close();
    });
    footer.appendChild(saveBtn);

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });

    nameInput.focus();

    function close(): void {
        document.body.removeChild(backdrop);
    }
}

function addField(
    body: HTMLElement,
    label: string,
    value: string,
    type: string,
): HTMLInputElement {
    const row = document.createElement('div');
    row.className = 'editor-modal-field';

    const lbl = document.createElement('label');
    lbl.className = 'editor-modal-field-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.className = 'editor-modal-input';
    row.appendChild(input);

    body.appendChild(row);
    return input;
}
