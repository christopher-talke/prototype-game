/**
 * Bottom error panel. Shows compile errors/warnings in a collapsible list
 * below the viewport. Clicking a row triggers select + pan to the item.
 *
 * Part of the editor layer.
 */

import type { CompileError, CompileResult } from '../compile/mapCompiler';
import type { EditorWorkingState } from '../state/EditorWorkingState';

export interface ErrorPanelHandle {
    update(result: CompileResult | null, state: EditorWorkingState): void;
    show(): void;
    hide(): void;
    toggle(): void;
    isVisible(): boolean;
}

/**
 * Mount the error panel into `container`. Returns a handle for updating
 * content and toggling visibility.
 *
 * `onRowClick` is called when the user clicks an error row so the caller
 * can select the item and pan the camera.
 */
export function mountErrorPanel(
    container: HTMLElement,
    onRowClick: (error: CompileError) => void,
): ErrorPanelHandle {
    container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'editor-bottom-panel hidden';
    container.appendChild(panel);

    const header = document.createElement('div');
    header.className = 'editor-bottom-panel-header';
    header.addEventListener('click', () => toggle());
    panel.appendChild(header);

    const headerLabel = document.createElement('span');
    headerLabel.textContent = 'Problems';
    header.appendChild(headerLabel);

    const countEl = document.createElement('span');
    countEl.className = 'editor-bottom-panel-count';
    header.appendChild(countEl);

    const body = document.createElement('div');
    body.className = 'editor-bottom-panel-body';
    panel.appendChild(body);

    let visible = false;

    function show(): void {
        visible = true;
        panel.classList.remove('hidden');
    }

    function hide(): void {
        visible = false;
        panel.classList.add('hidden');
    }

    function toggle(): void {
        if (visible) hide();
        else show();
    }

    function update(result: CompileResult | null, state: EditorWorkingState): void {
        body.innerHTML = '';

        if (!result || result.errors.length === 0) {
            countEl.textContent = result ? '0 problems' : '';
            if (!result || result.errors.length === 0) {
                if (visible && result?.passed) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'padding: 12px; color: #4caf50; font-size: 12px;';
                    empty.textContent = 'No problems found.';
                    body.appendChild(empty);
                }
            }
            return;
        }

        const n = result.errors.length;
        countEl.textContent = `${n} problem${n === 1 ? '' : 's'}`;

        for (const error of result.errors) {
            const row = document.createElement('div');
            row.className = 'editor-error-row';

            const icon = document.createElement('span');
            icon.className = `editor-error-severity ${error.severity}`;
            icon.textContent = error.severity === 'error' ? '●' : '△';
            row.appendChild(icon);

            const location = document.createElement('span');
            location.className = 'editor-error-location';
            const layerName = error.layerId
                ? (state.map.layers.find((l) => l.id === error.layerId)?.label ?? error.layerId)
                : 'Map';
            const itemName = error.itemGUID
                ? (state.byGUID.get(error.itemGUID)?.name ?? error.itemGUID.slice(0, 8))
                : '';
            location.textContent = itemName ? `${layerName} > ${itemName}` : layerName;
            row.appendChild(location);

            const msg = document.createElement('span');
            msg.className = 'editor-error-message';
            msg.textContent = error.message;
            msg.title = error.message;
            row.appendChild(msg);

            if (error.itemGUID || error.worldPosition) {
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => onRowClick(error));
            }

            body.appendChild(row);
        }
    }

    return { update, show, hide, toggle, isVisible: () => visible };
}
