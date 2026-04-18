/**
 * Floor selector dropdown for the left panel.
 *
 * Switching floors snapshots the current camera into per-floor storage,
 * restores the new floor's camera (or default), clears selection, and
 * resets the active layer to the first layer on the new floor.
 *
 * Part of the editor layer.
 */

import type { EditorCamera } from '../../viewport/EditorCamera';
import type { EditorWorkingState } from '../../state/EditorWorkingState';
import type { EditorStatePersisted } from '../../persistence/editorStatePersistence';
import type { SelectionStore } from '../../selection/selectionStore';

export interface FloorSelectorOptions {
    state: EditorWorkingState;
    camera: EditorCamera;
    persisted: EditorStatePersisted;
    selection: SelectionStore;
    onFloorChange: () => void;
    onPersist: () => void;
}

/** Build the floor selector dropdown. Returns a refresh function. */
export function mountFloorSelector(container: HTMLElement, opts: FloorSelectorOptions): () => void {
    container.innerHTML = '';
    container.classList.add('editor-floor-selector');

    const label = document.createElement('div');
    label.className = 'editor-floor-selector-label';
    label.textContent = 'Floor';
    container.appendChild(label);

    const select = document.createElement('select');
    select.className = 'editor-floor-selector-select';
    container.appendChild(select);

    const refresh = (): void => {
        select.innerHTML = '';
        const floors = [...opts.state.map.floors].sort((a, b) => a.renderOrder - b.renderOrder);
        for (const f of floors) {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.label;
            if (f.id === opts.state.activeFloorId) opt.selected = true;
            select.appendChild(opt);
        }
    };

    select.addEventListener('change', () => {
        const next = select.value;
        if (next === opts.state.activeFloorId) return;

        const oldFloor = opts.state.activeFloorId;
        opts.persisted.cameraPerFloor[oldFloor] = opts.camera.snapshot();

        opts.state.activeFloorId = next;
        const firstLayer = opts.state.map.layers.find((l) => l.floorId === next);
        opts.state.activeLayerId = firstLayer ? firstLayer.id : '';
        opts.selection.clear();

        const cam = opts.persisted.cameraPerFloor[next];
        if (cam) {
            opts.camera.restore(cam);
        } else {
            opts.camera.restore({ x: 0, y: 0, zoom: 1 });
            opts.camera.centerOn(
                opts.state.map.bounds.width / 2,
                opts.state.map.bounds.height / 2,
            );
        }

        opts.onFloorChange();
        opts.onPersist();
    });

    refresh();
    return refresh;
}
