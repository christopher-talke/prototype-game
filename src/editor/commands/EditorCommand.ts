/**
 * EditorCommand interface.
 *
 * Every mutation to `EditorWorkingState` goes through a command. `do` applies
 * the change, `undo` reverts it. `description` is human-readable using
 * display names (not GUIDs). `isStructural` marks create/delete so auto-save
 * can fire immediately after.
 *
 * Commands are serialisable so the undo stack can be persisted in IndexedDB.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';

export interface SerializedCommand {
    type: string;
    description: string;
    isStructural: boolean;
    payload: unknown;
}

export interface EditorCommand {
    readonly description: string;
    readonly isStructural: boolean;
    do(state: EditorWorkingState): void;
    undo(state: EditorWorkingState): void;
    serialize(): SerializedCommand;
}
