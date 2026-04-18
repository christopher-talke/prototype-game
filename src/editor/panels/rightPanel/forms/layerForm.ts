/**
 * Layer property form. Used when a layer (not an item) is selected.
 *
 * Part of the editor layer.
 */

import type { MapLayer } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import { buildRenameLayerCommand } from '../../../commands/renameLayerCommand';
import { buildSetLayerLockCommand } from '../../../commands/setLayerLockCommand';
import { buildSetLayerVisibilityCommand } from '../../../commands/setLayerVisibilityCommand';
import type { FieldDescriptor } from '../fieldDescriptor';

/** Build the field list for a layer. */
export function layerFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    layer: MapLayer,
): FieldDescriptor[] {
    const fields: FieldDescriptor[] = [];

    fields.push({
        key: 'label',
        label: 'Label',
        type: 'text',
        value: layer.label,
        onCommit: (next) => {
            const cmd = buildRenameLayerCommand(state, layer.id, next);
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'type',
        label: 'Type',
        type: 'readonly',
        value: layer.type,
    });
    fields.push({
        key: 'visible',
        label: 'Visible',
        type: 'bool',
        value: layer.visible,
        onCommit: (next) => {
            const cmd = buildSetLayerVisibilityCommand(state, layer.id, next);
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'locked',
        label: 'Locked',
        type: 'bool',
        value: layer.locked,
        onCommit: (next) => {
            const cmd = buildSetLayerLockCommand(state, layer.id, next);
            if (cmd) stack.dispatch(cmd);
        },
    });

    return fields;
}
