/**
 * Signal Registry modal dialog. Lists, adds, and removes MapSignals from
 * `map.signals`. Each change dispatches a structural SnapshotCommand.
 *
 * Part of the editor layer.
 */

import type { EditorCommand } from '../../commands/EditorCommand';
import { buildAddSignalCommand } from '../../commands/addSignalCommand';
import { buildRemoveSignalCommand } from '../../commands/removeSignalCommand';
import type { EditorWorkingState } from '../../state/EditorWorkingState';

/** Open the Signal Registry modal. `onDispatch` is called for each add/remove. */
export function openSignalRegistryDialog(
    state: EditorWorkingState,
    onDispatch: (cmd: EditorCommand) => void,
): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'editor-modal-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'editor-modal';
    modal.style.minWidth = '420px';
    backdrop.appendChild(modal);

    const titleEl = document.createElement('div');
    titleEl.className = 'editor-modal-title';
    titleEl.textContent = 'Signal Registry';
    modal.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'editor-modal-body';
    modal.appendChild(body);

    const listEl = document.createElement('div');
    listEl.className = 'editor-signal-list';
    body.appendChild(listEl);

    function renderList(): void {
        listEl.innerHTML = '';
        if (state.map.signals.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color: var(--editor-text-dim); font-size: 12px; padding: 8px 0;';
            empty.textContent = 'No signals defined.';
            listEl.appendChild(empty);
        }
        for (const signal of state.map.signals) {
            const row = document.createElement('div');
            row.className = 'editor-signal-row';

            const idEl = document.createElement('span');
            idEl.className = 'editor-signal-id';
            idEl.textContent = signal.id;
            row.appendChild(idEl);

            const labelEl = document.createElement('span');
            labelEl.className = 'editor-signal-label';
            labelEl.textContent = signal.label || '';
            row.appendChild(labelEl);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'editor-signal-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                const cmd = buildRemoveSignalCommand(state, signal.id);
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
    addBtn.className = 'editor-modal-btn editor-signal-add';
    addBtn.textContent = '+ Add Signal';
    addBtn.addEventListener('click', () => {
        const id = window.prompt('Signal ID (alphanumeric, no spaces):');
        if (!id) return;
        const trimmed = id.trim().replace(/\s+/g, '_');
        if (!trimmed) return;
        if (state.map.signals.some((s) => s.id === trimmed)) {
            window.alert(`Signal '${trimmed}' already exists.`);
            return;
        }
        const label = window.prompt('Signal label (optional):') ?? '';
        const cmd = buildAddSignalCommand(state, { id: trimmed, label: label.trim() });
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
