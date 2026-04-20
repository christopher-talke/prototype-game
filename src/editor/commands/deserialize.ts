/**
 * Deserialization dispatch for persisted commands.
 *
 * Keyed by command type tag. Add a branch when a new command class is
 * introduced. Unknown types throw; persistence callers catch and clear the
 * stack.
 *
 * Part of the editor layer.
 */

import type { EditorCommand, SerializedCommand } from './EditorCommand';
import { SNAPSHOT_COMMAND_TYPE, deserializeSnapshotCommand } from './SnapshotCommand';
import {
    CREATE_GROUP_COMMAND_TYPE,
    DISSOLVE_GROUP_COMMAND_TYPE,
    RENAME_GROUP_COMMAND_TYPE,
    deserializeCreateGroupCommand,
    deserializeDissolveGroupCommand,
    deserializeRenameGroupCommand,
} from './groupCommands';
import {
    MOVE_MEMBER_COMMAND_TYPE,
    deserializeMoveMemberCommand,
} from './moveMemberCommand';
import { COMPOSITE_COMMAND_TYPE, CompositeCommand } from './compositeCommand';

/** Rehydrate an `EditorCommand` from its serialized form. */
export function deserializeCommand(serialized: SerializedCommand): EditorCommand {
    switch (serialized.type) {
        case SNAPSHOT_COMMAND_TYPE:
            return deserializeSnapshotCommand(serialized);
        case CREATE_GROUP_COMMAND_TYPE:
            return deserializeCreateGroupCommand(serialized);
        case DISSOLVE_GROUP_COMMAND_TYPE:
            return deserializeDissolveGroupCommand(serialized);
        case RENAME_GROUP_COMMAND_TYPE:
            return deserializeRenameGroupCommand(serialized);
        case MOVE_MEMBER_COMMAND_TYPE:
            return deserializeMoveMemberCommand(serialized);
        case COMPOSITE_COMMAND_TYPE: {
            const payload = serialized.payload as { description: string; children: SerializedCommand[] };
            const children = payload.children.map(deserializeCommand);
            return new CompositeCommand(children, payload.description);
        }
        default:
            throw new Error(`deserializeCommand: unknown type "${serialized.type}"`);
    }
}
