/**
 * Floor Management modal dialog. Lists floors with rename-in-place and
 * remove buttons; provides an Add Floor button. Each change dispatches a
 * structural SnapshotCommand. Delete confirms before dispatching.
 *
 * Part of the editor layer.
 */

import type { EditorCommand } from '../../commands/EditorCommand';
import { buildAddFloorCommand } from '../../commands/addFloorCommand';
import { buildRemoveFloorCommand } from '../../commands/removeFloorCommand';
import { buildRenameFloorCommand } from '../../commands/renameFloorCommand';
import type { EditorWorkingState } from '../../state/EditorWorkingState';

/** Open the Floor Management modal. `onDispatch` is called for each add/remove/rename. */
export function openFloorManagementDialog(
    state: EditorWorkingState,
    onDispatch: (cmd: EditorCommand) => void,
): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'editor-modal-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'editor-modal';
    modal.style.minWidth = '460px';
    backdrop.appendChild(modal);

    const titleEl = document.createElement('div');
    titleEl.className = 'editor-modal-title';
    titleEl.textContent = 'Floor Management';
    modal.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'editor-modal-body';
    modal.appendChild(body);

    const listEl = document.createElement('div');
    listEl.className = 'editor-floor-list';
    body.appendChild(listEl);

    function renderList(): void {
        listEl.innerHTML = '';
        const floors = [...state.map.floors].sort((a, b) => a.renderOrder - b.renderOrder);
        if (floors.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color: var(--editor-text-dim); font-size: 12px; padding: 8px 0;';
            empty.textContent = 'No floors defined.';
            listEl.appendChild(empty);
            return;
        }

        for (const floor of floors) {
            const row = document.createElement('div');
            row.className = 'editor-floor-row';

            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.className = 'editor-modal-input editor-floor-label';
            labelInput.value = floor.label;
            const commitRename = (): void => {
                const next = labelInput.value.trim();
                if (!next || next === floor.label) {
                    labelInput.value = floor.label;
                    return;
                }
                const cmd = buildRenameFloorCommand(state, floor.id, next);
                if (cmd) {
                    onDispatch(cmd);
                    renderList();
                }
            };
            labelInput.addEventListener('blur', commitRename);
            labelInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') labelInput.blur();
                else if (e.key === 'Escape') {
                    labelInput.value = floor.label;
                    labelInput.blur();
                }
            });
            row.appendChild(labelInput);

            const idEl = document.createElement('span');
            idEl.className = 'editor-floor-id';
            idEl.textContent = floor.id.slice(0, 8);
            idEl.title = floor.id;
            row.appendChild(idEl);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'editor-floor-remove';
            removeBtn.textContent = 'Remove';
            const isOnlyFloor = state.map.floors.length <= 1;
            if (isOnlyFloor) {
                removeBtn.disabled = true;
                removeBtn.title = 'Cannot remove the last remaining floor';
            }
            removeBtn.addEventListener('click', () => {
                const ok = window.confirm(
                    `Delete floor '${floor.label}' and all of its layers, items, and zones?`,
                );
                if (!ok) return;
                const cmd = buildRemoveFloorCommand(state, floor.id);
                if (cmd) {
                    onDispatch(cmd);
                    renderList();
                }
            });
            row.appendChild(removeBtn);

            listEl.appendChild(row);
        }
    }

    renderList();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'editor-modal-btn editor-floor-add';
    addBtn.textContent = '+ Add Floor';
    addBtn.addEventListener('click', () => {
        const label = window.prompt('Floor label:');
        if (!label) return;
        const trimmed = label.trim();
        if (!trimmed) return;
        const cmd = buildAddFloorCommand(state, trimmed);
        onDispatch(cmd);
        renderList();
    });
    body.appendChild(addBtn);

    const footer = document.createElement('div');
    footer.className = 'editor-modal-footer';
    modal.appendChild(footer);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'editor-modal-btn primary';
    closeBtn.textContent = 'Done';
    closeBtn.addEventListener('click', close);
    footer.appendChild(closeBtn);

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });

    function close(): void {
        document.body.removeChild(backdrop);
    }
}
