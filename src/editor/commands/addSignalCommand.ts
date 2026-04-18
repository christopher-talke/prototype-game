/**
 * Factory: build a SnapshotCommand that appends a new MapSignal to
 * `map.signals`. Structural (adds an item).
 *
 * Part of the editor layer.
 */

import type { MapData, MapSignal } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';

/** Build a command that adds `signal` to the signal registry. */
export function buildAddSignalCommand(
    state: EditorWorkingState,
    signal: MapSignal,
): SnapshotCommand {
    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;
    working.signals.push(signal);
    const after = JSON.stringify(working);
    return new SnapshotCommand(before, after, `Add signal '${signal.id}'`, true);
}
