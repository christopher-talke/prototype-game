/**
 * Linear undo/redo stack with a pointer.
 *
 * New commands after `undo()` truncate the forward stack. Depth cap is 100;
 * overflow trims from the front. `lastSavedPointer` tracks the pointer at the
 * most recent save so `isDirty()` can detect unsaved changes.
 *
 * Listeners are notified after every pointer change so UI (title bar, menu
 * enable/disable) can react.
 *
 * Part of the editor layer.
 */

import type { EditorCommand } from './EditorCommand';
import type { EditorWorkingState } from '../state/EditorWorkingState';

const MAX_DEPTH = 100;

type Listener = () => void;

export class CommandStack {
    private stack: EditorCommand[] = [];
    /** Index of the most recently applied command. -1 when stack is empty / fully undone. */
    private pointer = -1;
    private lastSavedPointer = -1;
    private listeners: Set<Listener> = new Set();

    constructor(private readonly state: EditorWorkingState) {}

    /** Apply a command, truncate forward history, push, advance pointer. */
    dispatch(cmd: EditorCommand): void {
        cmd.do(this.state);
        if (this.pointer < this.stack.length - 1) {
            this.stack.length = this.pointer + 1;
        }
        this.stack.push(cmd);
        this.pointer = this.stack.length - 1;

        if (this.stack.length > MAX_DEPTH) {
            const trim = this.stack.length - MAX_DEPTH;
            this.stack.splice(0, trim);
            this.pointer -= trim;
            if (this.lastSavedPointer >= 0) {
                this.lastSavedPointer -= trim;
                if (this.lastSavedPointer < -1) this.lastSavedPointer = Number.NEGATIVE_INFINITY;
            }
        }
        this.notify();
    }

    /** Undo the current command if any. */
    undo(): void {
        if (this.pointer < 0) return;
        const cmd = this.stack[this.pointer];
        cmd.undo(this.state);
        this.pointer -= 1;
        this.notify();
    }

    /** Redo the next forward command if any. */
    redo(): void {
        if (this.pointer >= this.stack.length - 1) return;
        this.pointer += 1;
        this.stack[this.pointer].do(this.state);
        this.notify();
    }

    /** True if the current pointer differs from the last-saved pointer. */
    isDirty(): boolean {
        return this.pointer !== this.lastSavedPointer;
    }

    /** Record the current pointer as the most recent saved state. */
    markSaved(): void {
        this.lastSavedPointer = this.pointer;
        this.notify();
    }

    /** True if there is a command that can be undone. */
    canUndo(): boolean {
        return this.pointer >= 0;
    }

    /** True if there is a command that can be redone. */
    canRedo(): boolean {
        return this.pointer < this.stack.length - 1;
    }

    /** Description of the most-recent applied command, or null. */
    topDescription(): string | null {
        return this.pointer >= 0 ? this.stack[this.pointer].description : null;
    }

    /** Clear the stack; called after load or content-hash mismatch. */
    reset(): void {
        this.stack = [];
        this.pointer = -1;
        this.lastSavedPointer = -1;
        this.notify();
    }

    /** Return the serialised stack + pointer for persistence. */
    serialize(): { stack: ReturnType<EditorCommand['serialize']>[]; pointer: number } {
        return {
            stack: this.stack.map((c) => c.serialize()),
            pointer: this.pointer,
        };
    }

    /**
     * Replace the live stack with a list of already-constructed commands and a
     * pointer. No commands are applied; the caller is responsible for ensuring
     * `state` matches the pointer position.
     */
    restore(commands: EditorCommand[], pointer: number): void {
        this.stack = commands.slice();
        this.pointer = Math.min(Math.max(-1, pointer), this.stack.length - 1);
        this.lastSavedPointer = this.pointer;
        this.notify();
    }

    /** Subscribe to change notifications. Returns an unsubscribe function. */
    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const l of this.listeners) l();
    }
}
