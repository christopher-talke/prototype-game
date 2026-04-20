/**
 * Factory: rename a placement item via its `label` field. Non-structural.
 *
 * Layers and floors have their own dedicated rename commands
 * (`buildRenameLayerCommand`, `buildRenameFloorCommand`). This command targets
 * the shared `label` field present on Wall, ObjectPlacement, EntityPlacement,
 * DecalPlacement, LightPlacement, NavHint, and Zone.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData, setItemLabel } from './mapMutators';

/** Build a rename command for a placement item. Returns null on unknown guid or no-op rename. */
export function buildRenameItemCommand(
    state: EditorWorkingState,
    guid: string,
    label: string,
): SnapshotCommand | null {
    if (!state.byGUID.has(guid)) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    setItemLabel(working, guid, label);
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, 'Rename item', false);
}
