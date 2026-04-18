/**
 * List of layers on the active floor.
 *
 * Activating a layer is a direct mutation (not a command). Toggling
 * visibility/lock and renaming dispatch through the command stack.
 *
 * Part of the editor layer.
 */

import type { CommandStack } from '../../commands/CommandStack';
import type { EditorWorkingState } from '../../state/EditorWorkingState';
import { buildSetLayerVisibilityCommand } from '../../commands/setLayerVisibilityCommand';
import { buildSetLayerLockCommand } from '../../commands/setLayerLockCommand';
import { buildRenameLayerCommand } from '../../commands/renameLayerCommand';
import { buildLayerListItem } from './layerListItem';

export interface LayerListOptions {
    state: EditorWorkingState;
    stack: CommandStack;
    onActiveLayerChange: () => void;
    onPersist: () => void;
}

/** Build the layer list. Returns refresh fn. */
export function mountLayerList(container: HTMLElement, opts: LayerListOptions): () => void {
    container.innerHTML = '';
    container.classList.add('editor-layer-list');

    const refresh = (): void => {
        container.innerHTML = '';
        const layers = opts.state.map.layers.filter((l) => l.floorId === opts.state.activeFloorId);
        for (const layer of layers) {
            const row = buildLayerListItem({
                layer,
                isActive: layer.id === opts.state.activeLayerId,
                onActivate: () => {
                    if (opts.state.activeLayerId === layer.id) return;
                    opts.state.activeLayerId = layer.id;
                    opts.onActiveLayerChange();
                    opts.onPersist();
                    refresh();
                },
                onToggleVisibility: () => {
                    const cmd = buildSetLayerVisibilityCommand(opts.state, layer.id, !layer.visible);
                    if (cmd) opts.stack.dispatch(cmd);
                },
                onToggleLock: () => {
                    const cmd = buildSetLayerLockCommand(opts.state, layer.id, !layer.locked);
                    if (cmd) opts.stack.dispatch(cmd);
                },
                onRename: (next) => {
                    const cmd = buildRenameLayerCommand(opts.state, layer.id, next);
                    if (cmd) opts.stack.dispatch(cmd);
                },
            });
            container.appendChild(row);
        }
    };

    refresh();
    return refresh;
}
