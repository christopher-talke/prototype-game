/**
 * Play-test entry from the editor. Serializes the current map and camera
 * state to sessionStorage and navigates to the game page.
 *
 * The game page detects the `editor_playtest_map` key and auto-launches.
 * The "Exit Play-Test" button in the game navigates back to the URL stored
 * in `editor_playtest_return_url`.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { snapshotJson } from '../state/serializeToMapData';

const MAP_KEY = 'editor_playtest_map';
const RETURN_MAP_KEY = 'editor_return_map';
const RETURN_KEY = 'editor_playtest_return_url';

/**
 * Serialize the current map and navigate to the game page for play-testing.
 * The camera snapshot is embedded in the return URL as query parameters so
 * the editor can restore it on return. Writes two session entries: one
 * consumed by the game page on launch, one reserved for the editor to
 * reload its state when the user exits play-test.
 */
export function enterPlayTest(state: EditorWorkingState): void {
    const json = snapshotJson(state);
    sessionStorage.setItem(MAP_KEY, json);
    sessionStorage.setItem(RETURN_MAP_KEY, json);
    sessionStorage.setItem(RETURN_KEY, window.location.href);
    window.location.href = '/';
}
