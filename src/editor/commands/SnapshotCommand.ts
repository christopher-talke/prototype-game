/**
 * Day-1 command implementation: full MapData JSON snapshots before and after.
 *
 * `do` replaces the working state from `afterJson`. `undo` replaces it from
 * `beforeJson`. Memory cost is ~100-300 MB worst case at max map size and
 * max stack depth; acceptable for day-1, planned to migrate to structural
 * diffs post-ship.
 *
 * Part of the editor layer.
 */

import type { EditorCommand, SerializedCommand } from './EditorCommand';
import { type EditorWorkingState, replaceFromSnapshot } from '../state/EditorWorkingState';

export const SNAPSHOT_COMMAND_TYPE = 'snapshot';

export interface SnapshotPayload {
    beforeJson: string;
    afterJson: string;
}

export class SnapshotCommand implements EditorCommand {
    readonly description: string;
    readonly isStructural: boolean;
    private readonly beforeJson: string;
    private readonly afterJson: string;

    constructor(beforeJson: string, afterJson: string, description: string, isStructural = false) {
        this.beforeJson = beforeJson;
        this.afterJson = afterJson;
        this.description = description;
        this.isStructural = isStructural;
    }

    do(state: EditorWorkingState): void {
        replaceFromSnapshot(state, this.afterJson);
    }

    undo(state: EditorWorkingState): void {
        replaceFromSnapshot(state, this.beforeJson);
    }

    serialize(): SerializedCommand {
        const payload: SnapshotPayload = {
            beforeJson: this.beforeJson,
            afterJson: this.afterJson,
        };
        return {
            type: SNAPSHOT_COMMAND_TYPE,
            description: this.description,
            isStructural: this.isStructural,
            payload,
        };
    }
}

/** Rehydrate a previously serialized SnapshotCommand. */
export function deserializeSnapshotCommand(serialized: SerializedCommand): SnapshotCommand {
    const payload = serialized.payload as SnapshotPayload;
    return new SnapshotCommand(
        payload.beforeJson,
        payload.afterJson,
        serialized.description,
        serialized.isStructural,
    );
}
