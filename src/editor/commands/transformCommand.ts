/**
 * Factory: build a SnapshotCommand that translates / rotates / scales the
 * specified items by per-item deltas. Non-structural (auto-save deferred,
 * per dirty-tracker rules).
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { applyTransforms, cloneMapData, type ItemTransformDelta } from './mapMutators';

/** Build a SnapshotCommand for the given transform deltas. Returns null if no items. */
export function buildTransformCommand(
    state: EditorWorkingState,
    transforms: ItemTransformDelta[],
    description?: string,
): SnapshotCommand | null {
    if (transforms.length === 0) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    applyTransforms(working, transforms);
    const after = JSON.stringify(working);
    if (after === before) return null;
    const desc = description ?? defaultDescription(transforms);
    return new SnapshotCommand(before, after, desc, false);
}

function defaultDescription(transforms: ItemTransformDelta[]): string {
    if (transforms.length === 1) {
        const t = transforms[0];
        if (t.dRotation && !t.dx && !t.dy) return `Rotate item`;
        if (t.scaleMultiplier && !t.dx && !t.dy) return `Scale item`;
        return `Move item`;
    }
    return `Move ${transforms.length} items`;
}
