/**
 * Editor-state persistence in IndexedDB.
 *
 * Stored schema matches the `EditorStatePersisted` shape in the phase doc.
 * Keyed by file-path (filename day-1, see `filePathKey`). Separate from the
 * user's map file -- never written to disk.
 *
 * Part of the editor layer.
 */

import type { SerializedCommand } from '../commands/EditorCommand';

import { STORE_EDITOR_STATE, idbGet, idbPut } from './IndexedDbStore';

export interface CameraSnapshot {
    x: number;
    y: number;
    zoom: number;
}

export interface PanelCollapseState {
    left: boolean;
    right: boolean;
}

export interface PaletteRecents {
    /** Most-recently-used object def IDs, newest first, capped at 8. */
    object: string[];
    /** Most-recently-used entity def IDs, newest first, capped at 8. */
    entity: string[];
}

export interface EditorStatePersisted {
    cameraPerFloor: Record<string, CameraSnapshot>;
    activeFloorId: string;
    activeLayerId: string;
    panelCollapseState: PanelCollapseState;
    activeTool: string;
    snapEnabled: boolean;
    gridVisible: boolean;
    snapResolution: number;
    selectedItemGUIDs: string[];
    undoStack: SerializedCommand[];
    undoPointer: number;
    lastCompileErrors: unknown[];
    groups: unknown[];
    contentHash: string;
    paletteRecents: PaletteRecents;
}

/** Default persisted state for a freshly opened file with no IDB entry. */
export function defaultEditorState(): EditorStatePersisted {
    return {
        cameraPerFloor: {},
        activeFloorId: '',
        activeLayerId: '',
        panelCollapseState: { left: false, right: false },
        activeTool: 'select',
        snapEnabled: false,
        gridVisible: true,
        snapResolution: 8,
        selectedItemGUIDs: [],
        undoStack: [],
        undoPointer: -1,
        lastCompileErrors: [],
        groups: [],
        contentHash: '',
        paletteRecents: { object: [], entity: [] },
    };
}

/** Load the editor state for `filePath`, or return defaults if none. */
export async function loadEditorState(filePath: string): Promise<EditorStatePersisted> {
    const stored = await idbGet<EditorStatePersisted>(STORE_EDITOR_STATE, filePath);
    if (!stored) return defaultEditorState();
    if (!stored.paletteRecents) stored.paletteRecents = { object: [], entity: [] };
    return stored;
}

/** Persist the editor state for `filePath`. */
export async function saveEditorState(
    filePath: string,
    state: EditorStatePersisted,
): Promise<void> {
    await idbPut(STORE_EDITOR_STATE, filePath, state);
}

/** Copy editor state from one file path key to another (used by Save As). */
export async function copyEditorState(from: string, to: string): Promise<void> {
    const stored = await idbGet<EditorStatePersisted>(STORE_EDITOR_STATE, from);
    if (stored) await idbPut(STORE_EDITOR_STATE, to, stored);
}
