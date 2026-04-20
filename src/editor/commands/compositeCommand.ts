/**
 * Minimal composite: runs a sequence of EditorCommands as one undo/redo unit.
 *
 * Not a general solution (serialization just inlines children's serialized
 * payloads) but enough for local sequencing like drag-drop moves that both
 * pull a node out of a group and reorder it in a backing array.
 *
 * Part of the editor layer.
 */

import type { EditorCommand, SerializedCommand } from './EditorCommand';
import type { EditorWorkingState } from '../state/EditorWorkingState';

export const COMPOSITE_COMMAND_TYPE = 'composite';

interface CompositePayload {
    description: string;
    isStructural: boolean;
    children: SerializedCommand[];
}

export class CompositeCommand implements EditorCommand {
    readonly description: string;
    readonly isStructural: boolean;

    constructor(
        private readonly children: EditorCommand[],
        description: string,
    ) {
        this.description = description;
        this.isStructural = children.some((c) => c.isStructural);
    }

    do(state: EditorWorkingState): void {
        for (const c of this.children) c.do(state);
    }

    undo(state: EditorWorkingState): void {
        for (let i = this.children.length - 1; i >= 0; i--) this.children[i].undo(state);
    }

    serialize(): SerializedCommand {
        const payload: CompositePayload = {
            description: this.description,
            isStructural: this.isStructural,
            children: this.children.map((c) => c.serialize()),
        };
        return {
            type: COMPOSITE_COMMAND_TYPE,
            description: this.description,
            isStructural: this.isStructural,
            payload,
        };
    }
}
