/**
 * Entity placement property form. Includes def name (readonly), transform,
 * plus schema-driven initialState fields generated from the entity def's
 * `stateSchema`.
 *
 * Part of the editor layer.
 */

import type {
    EntityPlacement,
    EntityStateFieldDescriptor,
    MapData,
} from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import { buildSetPropertyCommand } from '../../../commands/setPropertyCommand';
import type { FieldDescriptor } from '../fieldDescriptor';
import { positionFields, rotationField } from '../transformSection';

/** Build the field list for an entity placement. */
export function entityFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    ent: EntityPlacement,
): FieldDescriptor[] {
    const def = state.map.entityDefs.find((d) => d.id === ent.entityTypeId);
    const ctx = { state, stack, guid: ent.id };

    const fields: FieldDescriptor[] = [];
    fields.push({
        key: 'def',
        label: 'Definition',
        type: 'readonly',
        value: def ? def.label : ent.entityTypeId,
    });
    fields.push(...positionFields(ctx, ent.position));
    fields.push(rotationField(ctx, ent.rotation));

    if (def?.stateSchema) {
        for (const [key, descriptor] of Object.entries(def.stateSchema)) {
            fields.push(buildStateField(state, stack, ent, key, descriptor, state.map));
        }
    }

    return fields;
}

function buildStateField(
    state: EditorWorkingState,
    stack: CommandStack,
    ent: EntityPlacement,
    key: string,
    descriptor: EntityStateFieldDescriptor,
    map: MapData,
): FieldDescriptor {
    const current = ent.initialState[key];

    const commit = (next: unknown) => {
        const cmd = buildSetPropertyCommand(
            state,
            ent.id,
            ['initialState', key],
            next,
            `Set ${key}`,
        );
        if (cmd) stack.dispatch(cmd);
    };

    switch (descriptor.type) {
        case 'layerId':
            return {
                key,
                label: key,
                type: 'enum',
                value: typeof current === 'string' ? current : '',
                options: map.layers.map((l) => ({ value: l.id, label: l.label })),
                onCommit: commit as (v: string) => void,
            };
        case 'entityId':
            return {
                key,
                label: key,
                type: 'enum',
                value: typeof current === 'string' ? current : '',
                options: map.entityDefs.map((d) => ({ value: d.id, label: d.label })),
                onCommit: commit as (v: string) => void,
            };
        case 'teamId':
            return {
                key,
                label: key,
                type: 'text',
                value: typeof current === 'string' ? current : '',
                onCommit: commit as (v: string) => void,
            };
        case 'signalId':
            return {
                key,
                label: key,
                type: 'enum',
                value: typeof current === 'string' ? current : '',
                options: map.signals.map((s) => ({ value: s.id, label: s.label })),
                onCommit: commit as (v: string) => void,
            };
        case 'primitive':
            if (typeof current === 'number') {
                return {
                    key,
                    label: key,
                    type: 'number',
                    value: current,
                    onCommit: commit as (v: number) => void,
                };
            }

            if (typeof current === 'boolean') {
                return {
                    key,
                    label: key,
                    type: 'bool',
                    value: current,
                    onCommit: commit as (v: boolean) => void,
                };
            }

            return {
                key,
                label: key,
                type: 'text',
                value: current === undefined || current === null ? '' : String(current),
                onCommit: commit as (v: string) => void,
            };
    }
}
