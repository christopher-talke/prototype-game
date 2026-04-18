/**
 * Object placement property form. Includes def name (readonly), transform.
 *
 * Part of the editor layer.
 */

import type { ObjectPlacement, MapData } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import type { FieldDescriptor } from '../fieldDescriptor';
import { positionFields, rotationField, scaleFields } from '../transformSection';

/** Build the field list for an object placement. */
export function objectFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    obj: ObjectPlacement,
): FieldDescriptor[] {
    const def = findDef(state.map, obj.objectDefId);
    const ctx = { state, stack, guid: obj.id };

    const fields: FieldDescriptor[] = [];
    fields.push({
        key: 'def',
        label: 'Definition',
        type: 'readonly',
        value: def ? def.label : obj.objectDefId,
    });
    fields.push(...positionFields(ctx, obj.position));
    fields.push(rotationField(ctx, obj.rotation));
    fields.push(...scaleFields(ctx, obj.scale));
    return fields;
}

function findDef(map: MapData, id: string) {
    return map.objectDefs.find((d) => d.id === id);
}
