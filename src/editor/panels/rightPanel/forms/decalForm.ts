/**
 * Decal placement property form.
 *
 * Part of the editor layer.
 */

import type { DecalPlacement } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import { buildSetPropertyCommand } from '../../../commands/setPropertyCommand';
import type { FieldDescriptor } from '../fieldDescriptor';
import { positionFields, rotationField, scaleFields } from '../transformSection';

/** Build the field list for a decal placement. */
export function decalFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    decal: DecalPlacement,
): FieldDescriptor[] {
    const ctx = { state, stack, guid: decal.id };
    const fields: FieldDescriptor[] = [];

    fields.push({
        key: 'assetPath',
        label: 'Asset',
        type: 'readonly',
        value: decal.assetPath,
    });
    fields.push(...positionFields(ctx, decal.position));
    fields.push(rotationField(ctx, decal.rotation));
    fields.push(...scaleFields(ctx, decal.scale));
    fields.push({
        key: 'alpha',
        label: 'Alpha',
        type: 'number',
        value: decal.alpha,
        step: 0.05,
        min: 0,
        max: 1,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, decal.id, ['alpha'], next, 'Set alpha');
            if (cmd) stack.dispatch(cmd);
        },
    });
    return fields;
}
