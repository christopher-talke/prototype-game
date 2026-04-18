/**
 * Factory: rename a layer's label. Structural.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, findLayer } from './mapMutators';

export function buildRenameLayerCommand(
    state: EditorWorkingState,
    layerId: string,
    label: string,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const layer = findLayer(working, layerId);
    if (!layer) return null;
    if (layer.label === label) return null;
    layer.label = label;
    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, 'Rename layer', true);
}
