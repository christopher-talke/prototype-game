/**
 * Project EditorWorkingState back to MapData for save / snapshot.
 *
 * Day-1 the working state wraps the live MapData directly, so this is a
 * structured deep-clone of `state.map` via JSON round-trip. When the working
 * state gains edit-time-only augmentations this is the place to strip them.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState } from './EditorWorkingState';

/** Produce a MapData value representing the current working state. */
export function serializeToMapData(state: EditorWorkingState): MapData {
    return JSON.parse(JSON.stringify(state.map)) as MapData;
}

/** Convenience: snapshot the current working state as a JSON string. */
export function snapshotJson(state: EditorWorkingState): string {
    return JSON.stringify(state.map);
}
