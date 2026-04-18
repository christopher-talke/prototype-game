/**
 * Light placement property form. Position, color, intensity, radius, cone.
 *
 * Part of the editor layer.
 */

import type { LightPlacement } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import { buildSetPropertyCommand } from '../../../commands/setPropertyCommand';
import type { FieldDescriptor } from '../fieldDescriptor';
import { positionFields } from '../transformSection';

/** Build the field list for a light placement. */
export function lightFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    light: LightPlacement,
): FieldDescriptor[] {
    const ctx = { state, stack, guid: light.id };
    const fields: FieldDescriptor[] = [];

    fields.push(...positionFields(ctx, light.position));
    fields.push({
        key: 'color',
        label: 'Color',
        type: 'color',
        value: light.color,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, light.id, ['color'], next, 'Set color');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'intensity',
        label: 'Intensity',
        type: 'number',
        value: light.intensity,
        step: 0.05,
        min: 0,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, light.id, ['intensity'], next, 'Set intensity');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'radius',
        label: 'Radius',
        type: 'number',
        value: light.radius,
        step: 1,
        min: 0,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, light.id, ['radius'], next, 'Set radius');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'coneAngle',
        label: 'Cone angle (rad)',
        type: 'number',
        value: light.coneAngle,
        step: 0.01,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, light.id, ['coneAngle'], next, 'Set cone angle');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'coneDirection',
        label: 'Cone direction (rad)',
        type: 'number',
        value: light.coneDirection,
        step: 0.01,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, light.id, ['coneDirection'], next, 'Set cone direction');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'castShadows',
        label: 'Cast shadows',
        type: 'bool',
        value: light.castShadows,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, light.id, ['castShadows'], next, 'Set cast shadows');
            if (cmd) stack.dispatch(cmd);
        },
    });
    return fields;
}
