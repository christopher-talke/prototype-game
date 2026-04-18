/**
 * Stable IndexedDB key derivation for file handles.
 *
 * `FileSystemFileHandle.name` is just the filename, not a full path. Day-1
 * we use the filename verbatim as the editor-state key. Caveat: two files
 * with the same name from different directories would share editor state.
 * Acceptable for Phase 1; can be upgraded to an isSameEntry()-based lookup
 * post-ship.
 *
 * The special key `UNTITLED_KEY` is used for in-memory-only (unsaved) maps
 * so their editor state (camera, panel collapse) persists across reloads.
 *
 * Part of the editor layer.
 */

export const UNTITLED_KEY = '::untitled';

/** Compute the IndexedDB key for a file handle, or `UNTITLED_KEY` if null. */
export function filePathKey(handle: FileSystemFileHandle | null): string {
    if (!handle) return UNTITLED_KEY;
    return handle.name;
}
