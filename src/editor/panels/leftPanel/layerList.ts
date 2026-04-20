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
import { buildDragReorderCommand } from '../../commands/buildDragReorderCommand';
import { buildLayerListItem } from './layerListItem';
import { wireDragReorder } from './rowDragReorder';

export interface LayerListOptions {
    state: EditorWorkingState;
    stack: CommandStack;
    onActiveLayerChange: () => void;
    onPersist: () => void;
    /** Returns the set of layer IDs that have at least one compile error. */
    getErrorLayerIds?: () => Set<string>;
    /** Shared rename-callbacks registry; keyed by layer id. */
    renameCallbacks?: Map<string, () => void>;
}

/** Build the layer list. Returns refresh fn. */
export function mountLayerList(container: HTMLElement, opts: LayerListOptions): () => void {
    container.innerHTML = '';
    container.classList.add('editor-layer-list');

    const refresh = (): void => {
        container.innerHTML = '';
        const layers = opts.state.map.layers.filter((l) => l.floorId === opts.state.activeFloorId);
        const errorIds = opts.getErrorLayerIds?.() ?? new Set<string>();
        for (const layer of layers) {
            const hasError = errorIds.has(layer.id);
            const handle = buildLayerListItem({
                hasError,
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
            wireDragReorder(handle.el, {
                guid: layer.id,
                container: `layers:${layer.floorId}`,
                node: 'layer',
            }, {
                onDrop: (src, position) => {
                    const cmd = buildDragReorderCommand(opts.state, src.guid, layer.id, position);
                    if (cmd) opts.stack.dispatch(cmd);
                },
            });
            opts.renameCallbacks?.set(layer.id, handle.beginRename);
            container.appendChild(handle.el);
        }
    };

    refresh();
    return refresh;
}
