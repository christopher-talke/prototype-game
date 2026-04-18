/**
 * Factory: toggle a MapLayer.locked field. Structural.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, findLayer } from './mapMutators';

export function buildSetLayerLockCommand(
    state: EditorWorkingState,
    layerId: string,
    locked: boolean,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const layer = findLayer(working, layerId);
    if (!layer) return null;
    if (layer.locked === locked) return null;
    layer.locked = locked;
    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, locked ? 'Lock layer' : 'Unlock layer', true);
}
