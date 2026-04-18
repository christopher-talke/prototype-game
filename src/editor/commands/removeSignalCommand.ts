/**
 * Factory: build a SnapshotCommand that removes a MapSignal from
 * `map.signals` by ID. Structural (deletes an item).
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';

/** Build a command that removes the signal with the given ID. Returns null if not found. */
export function buildRemoveSignalCommand(
    state: EditorWorkingState,
    signalId: string,
): SnapshotCommand | null {
    const idx = state.map.signals.findIndex((s) => s.id === signalId);
    if (idx === -1) return null;
    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;
    working.signals.splice(idx, 1);
    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, `Remove signal '${signalId}'`, true);
}
