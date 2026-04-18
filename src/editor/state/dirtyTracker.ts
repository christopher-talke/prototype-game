/**
 * Dirty state bridge: command stack pointer vs. last-saved pointer.
 *
 * Subscribes to the `CommandStack` and relays `isDirty` to any observer. Also
 * attaches the `beforeunload` guard so the user is prompted before closing a
 * tab with unsaved changes.
 *
 * Part of the editor layer.
 */

import type { CommandStack } from '../commands/CommandStack';

type Listener = (dirty: boolean) => void;

export class DirtyTracker {
    private listeners: Set<Listener> = new Set();
    private last = false;

    constructor(private readonly stack: CommandStack) {
        stack.subscribe(() => {
            const current = stack.isDirty();
            if (current === this.last) return;
            this.last = current;
            for (const l of this.listeners) l(current);
        });

        window.addEventListener('beforeunload', (e) => {
            if (!stack.isDirty()) return;
            e.preventDefault();
            e.returnValue = '';
        });
    }

    isDirty(): boolean {
        return this.stack.isDirty();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
