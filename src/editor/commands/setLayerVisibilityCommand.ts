/**
 * Factory: toggle a MapLayer.visible field. Structural (impacts persistence).
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, findLayer } from './mapMutators';

export function buildSetLayerVisibilityCommand(
    state: EditorWorkingState,
    layerId: string,
    visible: boolean,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const layer = findLayer(working, layerId);
    if (!layer) return null;
    if (layer.visible === visible) return null;
    layer.visible = visible;
    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, visible ? 'Show layer' : 'Hide layer', true);
}
