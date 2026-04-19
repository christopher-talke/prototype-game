/**
 * Entity placement property form. Includes def name (readonly), transform,
 * plus schema-driven initialState fields generated from the entity def's
 * `stateSchema`.
 *
 * Supports the full EntityStateFieldDescriptor union: primitive/layerId/
 * entityId/teamId/signalId plus color/range/nested/array via a recursive
 * descriptor walk. All commits flow through buildSetPropertyCommand with the
 * full path so nested and array edits coalesce into single SnapshotCommands.
 *
 * Part of the editor layer.
 */

import type {
    EntityPlacement,
    EntityStateFieldDescriptor,
    MapData,
} from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import { defaultForEntityStateDescriptor } from '../../../commands/entityStateDefaults';
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
            fields.push(
                buildDescriptorField(
                    state,
                    stack,
                    ent,
                    key,
                    ['initialState', key],
                    descriptor,
                    ent.initialState[key],
                    state.map,
                ),
            );
        }
    }

    return fields;
}

/**
 * Recursive descriptor walker. Emits a FieldDescriptor bound to `path` on the
 * entity identified by `ent.id`. `current` is the live value at `path`.
 */
function buildDescriptorField(
    state: EditorWorkingState,
    stack: CommandStack,
    ent: EntityPlacement,
    label: string,
    path: string[],
    descriptor: EntityStateFieldDescriptor,
    current: unknown,
    map: MapData,
): FieldDescriptor {
    const commit = (next: unknown) => {
        const cmd = buildSetPropertyCommand(
            state,
            ent.id,
            path,
            next,
            `Set ${path.slice(1).join('.')}`,
        );
        if (cmd) stack.dispatch(cmd);
    };

    switch (descriptor.type) {
        case 'layerId':
            return {
                key: label,
                label,
                type: 'enum',
                value: typeof current === 'string' ? current : '',
                options: map.layers.map((l) => ({ value: l.id, label: l.label })),
                onCommit: commit as (v: string) => void,
            };
        case 'entityId':
            return {
                key: label,
                label,
                type: 'enum',
                value: typeof current === 'string' ? current : '',
                options: map.entityDefs.map((d) => ({ value: d.id, label: d.label })),
                onCommit: commit as (v: string) => void,
            };
        case 'teamId':
            return {
                key: label,
                label,
                type: 'text',
                value: typeof current === 'string' ? current : '',
                onCommit: commit as (v: string) => void,
            };
        case 'signalId':
            return {
                key: label,
                label,
                type: 'enum',
                value: typeof current === 'string' ? current : '',
                options: map.signals.map((s) => ({ value: s.id, label: s.label })),
                onCommit: commit as (v: string) => void,
            };
        case 'color': {
            const rgb =
                isRgb(current)
                    ? current
                    : { r: 0, g: 0, b: 0 };
            return {
                key: label,
                label,
                type: 'color',
                value: rgb,
                onCommit: commit as (v: { r: number; g: number; b: number }) => void,
            };
        }
        case 'range': {
            const num = typeof current === 'number' ? current : descriptor.min;
            return {
                key: label,
                label,
                type: 'range',
                value: num,
                min: descriptor.min,
                max: descriptor.max,
                step: descriptor.step,
                onCommit: commit as (v: number) => void,
            };
        }
        case 'nested': {
            const obj =
                typeof current === 'object' && current !== null && !Array.isArray(current)
                    ? (current as Record<string, unknown>)
                    : {};
            const subFields: FieldDescriptor[] = [];
            for (const [subKey, subDescriptor] of Object.entries(descriptor.fields)) {
                subFields.push(
                    buildDescriptorField(
                        state,
                        stack,
                        ent,
                        subKey,
                        [...path, subKey],
                        subDescriptor,
                        obj[subKey],
                        map,
                    ),
                );
            }
            return {
                key: label,
                label,
                type: 'nested',
                fields: subFields,
            };
        }
        case 'array': {
            const arr = Array.isArray(current) ? current : [];
            const items: FieldDescriptor[] = arr.map((el, i) =>
                buildDescriptorField(
                    state,
                    stack,
                    ent,
                    `[${i}]`,
                    [...path, String(i)],
                    descriptor.element,
                    el,
                    map,
                ),
            );

            const replaceArray = (next: unknown[]) => {
                const cmd = buildSetPropertyCommand(
                    state,
                    ent.id,
                    path,
                    next,
                    `Set ${path.slice(1).join('.')}`,
                );
                if (cmd) stack.dispatch(cmd);
            };

            return {
                key: label,
                label,
                type: 'array',
                items,
                onAdd: () => {
                    const live = readArrayAtPath(state.map, ent.id, path);
                    const next = [...live, defaultForEntityStateDescriptor(descriptor.element)];
                    replaceArray(next);
                },
                onRemove: (index: number) => {
                    const live = readArrayAtPath(state.map, ent.id, path);
                    if (index < 0 || index >= live.length) return;
                    const next = live.slice(0, index).concat(live.slice(index + 1));
                    replaceArray(next);
                },
            };
        }
        case 'primitive':
            if (typeof current === 'number') {
                return {
                    key: label,
                    label,
                    type: 'number',
                    value: current,
                    onCommit: commit as (v: number) => void,
                };
            }

            if (typeof current === 'boolean') {
                return {
                    key: label,
                    label,
                    type: 'bool',
                    value: current,
                    onCommit: commit as (v: boolean) => void,
                };
            }

            return {
                key: label,
                label,
                type: 'text',
                value: current === undefined || current === null ? '' : String(current),
                onCommit: commit as (v: string) => void,
            };
    }
}

function isRgb(v: unknown): v is { r: number; g: number; b: number } {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return typeof o.r === 'number' && typeof o.g === 'number' && typeof o.b === 'number';
}

/** Read the current array value at `path` on entity `entId` from live MapData. */
function readArrayAtPath(map: MapData, entId: string, path: string[]): unknown[] {
    let cursor: unknown;
    for (const layer of map.layers) {
        const hit = layer.entities.find((e) => e.id === entId);
        if (hit) {
            cursor = hit;
            break;
        }
    }
    if (!cursor) return [];
    for (const k of path) {
        if (typeof cursor !== 'object' || cursor === null) return [];
        cursor = (cursor as Record<string, unknown>)[k];
    }
    return Array.isArray(cursor) ? cursor : [];
}
