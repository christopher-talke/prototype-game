/**
 * NavHint property form. Type, position, radius, weight.
 *
 * Part of the editor layer.
 */

import type { NavHint, NavHintType } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import { buildSetPropertyCommand } from '../../../commands/setPropertyCommand';
import type { FieldDescriptor } from '../fieldDescriptor';
import { positionFields } from '../transformSection';

const NAV_HINT_TYPES: NavHintType[] = ['cover', 'choke', 'flank', 'danger', 'objective'];

/** Build the field list for a nav hint. */
export function navHintFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    hint: NavHint,
): FieldDescriptor[] {
    const ctx = { state, stack, guid: hint.id };
    const fields: FieldDescriptor[] = [];

    fields.push({
        key: 'type',
        label: 'Hint type',
        type: 'enum',
        value: hint.type,
        options: NAV_HINT_TYPES.map((t) => ({ value: t, label: t })),
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, hint.id, ['type'], next, 'Set hint type');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push(...positionFields(ctx, hint.position));
    fields.push({
        key: 'radius',
        label: 'Radius',
        type: 'number',
        value: hint.radius,
        step: 1,
        min: 0,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, hint.id, ['radius'], next, 'Set radius');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'weight',
        label: 'Weight',
        type: 'number',
        value: hint.weight,
        step: 0.1,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, hint.id, ['weight'], next, 'Set weight');
            if (cmd) stack.dispatch(cmd);
        },
    });
    return fields;
}
