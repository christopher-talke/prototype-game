/**
 * Tiny store holding the id of the group the user has "entered" via
 * double-click, so further single-clicks within it select individual members
 * instead of re-resolving to the outer group. Escape exits.
 *
 * Part of the editor layer.
 */

export type GroupEnterListener = () => void;

export class GroupEnterState {
    private current: string | null = null;
    private listeners = new Set<GroupEnterListener>();

    enteredId(): string | null {
        return this.current;
    }

    enter(groupId: string): void {
        if (this.current === groupId) return;
        this.current = groupId;
        this.notify();
    }

    exit(): void {
        if (this.current === null) return;
        this.current = null;
        this.notify();
    }

    subscribe(listener: GroupEnterListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const l of this.listeners) l();
    }
}
