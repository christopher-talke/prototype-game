/**
 * Right-panel property form for a selected group.
 *
 * Shown when the current selection is exactly the flattened membership of a
 * group (detected upstream via `findGroupForExactSelection`). Renders the
 * group name (renamable), member count, and a dissolve button. Dissolve is
 * rendered as a transient button; name edits dispatch a RenameGroupCommand.
 *
 * Part of the editor layer.
 */

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import type { SelectionStore } from '../../../selection/selectionStore';
import type { Group } from '../../../groups/Group';
import { buildRenameGroupCommand, buildDissolveGroupCommand } from '../../../commands/groupCommands';
import { groupMembersFlattened } from '../../../groups/groupQueries';
import type { FieldDescriptor } from '../fieldDescriptor';

/** Build the field list for a selected group. */
export function groupFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    selection: SelectionStore,
    group: Group,
): FieldDescriptor[] {
    const flatCount = groupMembersFlattened(state, group.id).length;
    const fields: FieldDescriptor[] = [];

    fields.push({
        key: 'group.name',
        label: 'Name',
        type: 'text',
        value: group.name,
        onCommit: (next) => {
            const cmd = buildRenameGroupCommand(state, group.id, next);
            if (cmd) stack.dispatch(cmd);
        },
    });

    fields.push({
        key: 'group.memberCount',
        label: 'Members',
        type: 'readonly',
        value: `${flatCount} item${flatCount === 1 ? '' : 's'} (${group.memberIds.length} direct)`,
    });

    fields.push({
        key: 'group.floor',
        label: 'Floor',
        type: 'readonly',
        value: floorLabel(state, group.floorId),
    });

    fields.push({
        key: 'group.id',
        label: 'Group id',
        type: 'guid',
        value: group.id,
    });

    fields.push({
        key: 'group.dissolveAction',
        label: 'Dissolve',
        type: 'enum',
        value: '',
        options: [
            { value: '', label: '(select to dissolve)' },
            { value: 'dissolve', label: 'Dissolve group' },
        ],
        onCommit: (next) => {
            if (next !== 'dissolve') return;
            const cmd = buildDissolveGroupCommand(state, group.id);
            if (!cmd) return;
            stack.dispatch(cmd);
            selection.clear();
        },
    });

    return fields;
}

function floorLabel(state: EditorWorkingState, floorId: string): string {
    const floor = state.map.floors.find((f) => f.id === floorId);
    return floor ? floor.label : floorId;
}
