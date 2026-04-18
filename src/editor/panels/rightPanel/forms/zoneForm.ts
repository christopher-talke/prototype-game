/**
 * Zone property form. Type, label, polygon vertex count, plus dynamic
 * meta block per zone type. For `trigger`, `signal` is validated against
 * `state.map.signals[]` and an inline red warning is shown if unknown.
 *
 * Part of the editor layer.
 */

import type { Zone, ZoneType } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import { buildSetPropertyCommand } from '../../../commands/setPropertyCommand';
import type { FieldDescriptor } from '../fieldDescriptor';
import { positionFields } from '../transformSection';

const ZONE_TYPES: ZoneType[] = [
    'spawn',
    'territory',
    'bombsite',
    'buyzone',
    'trigger',
    'extract',
    'audio',
    'floor-transition',
];

/** Build the field list for a zone. */
export function zoneFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    zone: Zone,
): FieldDescriptor[] {
    const ctx = { state, stack, guid: zone.id };
    const centroid = polygonCentroid(zone.polygon);

    const fields: FieldDescriptor[] = [];
    fields.push({
        key: 'type',
        label: 'Zone type',
        type: 'enum',
        value: zone.type,
        options: ZONE_TYPES.map((t) => ({ value: t, label: t })),
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, zone.id, ['type'], next, 'Set zone type');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'label',
        label: 'Label',
        type: 'text',
        value: zone.label,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, zone.id, ['label'], next, 'Set zone label');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'team',
        label: 'Team',
        type: 'text',
        value: zone.team ?? '',
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(
                state,
                zone.id,
                ['team'],
                next === '' ? undefined : next,
                'Set zone team',
            );
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push(...positionFields(ctx, centroid));
    fields.push({
        key: 'vertexCount',
        label: 'Vertices',
        type: 'readonly',
        value: String(zone.polygon.length),
    });

    fields.push(...metaFieldsFor(state, stack, zone));

    return fields;
}

function metaFieldsFor(
    state: EditorWorkingState,
    stack: CommandStack,
    zone: Zone,
): FieldDescriptor[] {
    const meta = (zone.meta ?? {}) as Record<string, unknown>;
    const commit = (key: string, value: unknown, desc: string) => {
        const cmd = buildSetPropertyCommand(state, zone.id, ['meta', key], value, desc);
        if (cmd) stack.dispatch(cmd);
    };

    switch (zone.type) {
        case 'spawn':
            return [
                {
                    key: 'meta.team',
                    label: 'Team',
                    type: 'text',
                    value: stringOr(meta.team, ''),
                    onCommit: (next) =>
                        commit('team', next === '' ? undefined : next, 'Set spawn team'),
                },
                {
                    key: 'meta.priority',
                    label: 'Priority',
                    type: 'number',
                    value: numberOr(meta.priority, 0),
                    step: 1,
                    onCommit: (next) => commit('priority', next, 'Set spawn priority'),
                },
            ];

        case 'territory':
            return [
                {
                    key: 'meta.territoryId',
                    label: 'Territory ID',
                    type: 'text',
                    value: stringOr(meta.territoryId, ''),
                    onCommit: (next) => commit('territoryId', next, 'Set territoryId'),
                },
                {
                    key: 'meta.team',
                    label: 'Team',
                    type: 'text',
                    value: stringOr(meta.team, ''),
                    onCommit: (next) =>
                        commit('team', next === '' ? undefined : next, 'Set territory team'),
                },
            ];

        case 'bombsite':
            return [
                {
                    key: 'meta.bombsiteLabel',
                    label: 'Bombsite',
                    type: 'enum',
                    value: stringOr(meta.bombsiteLabel, 'A'),
                    options: [
                        { value: 'A', label: 'A' },
                        { value: 'B', label: 'B' },
                    ],
                    onCommit: (next) => commit('bombsiteLabel', next, 'Set bombsite label'),
                },
            ];

        case 'buyzone':
            return [
                {
                    key: 'meta.team',
                    label: 'Team',
                    type: 'text',
                    value: stringOr(meta.team, ''),
                    onCommit: (next) =>
                        commit('team', next === '' ? undefined : next, 'Set buyzone team'),
                },
            ];

        case 'trigger': {
            const signalValue = stringOr(meta.signal, '');
            const signals = state.map.signals ?? [];
            const signalOptions = signals.map((s) => ({ value: s.id, label: s.label || s.id }));
            const signalKnown = signalValue === '' || signals.some((s) => s.id === signalValue);
            const warning = signalKnown ? undefined : 'Signal not found in registry';

            if (signalValue !== '' && !signalKnown) {
                signalOptions.unshift({ value: signalValue, label: `${signalValue} (missing)` });
            }

            return [
                {
                    key: 'meta.signal',
                    label: 'Signal',
                    type: 'enum',
                    value: signalValue,
                    options: [{ value: '', label: '(none)' }, ...signalOptions],
                    warning,
                    onCommit: (next) =>
                        commit('signal', next === '' ? undefined : next, 'Set trigger signal'),
                },
                {
                    key: 'meta.triggerCondition',
                    label: 'Condition',
                    type: 'enum',
                    value: stringOr(meta.triggerCondition, 'enter'),
                    options: [
                        { value: 'enter', label: 'enter' },
                        { value: 'exit', label: 'exit' },
                        { value: 'both', label: 'both' },
                    ],
                    onCommit: (next) => commit('triggerCondition', next, 'Set trigger condition'),
                },
            ];
        }

        case 'audio':
            return [
                {
                    key: 'meta.reverbProfile',
                    label: 'Reverb',
                    type: 'text',
                    value: stringOr(meta.reverbProfile, ''),
                    onCommit: (next) => commit('reverbProfile', next, 'Set reverb profile'),
                },
                {
                    key: 'meta.ambientLoop',
                    label: 'Ambient loop',
                    type: 'text',
                    value: stringOr(meta.ambientLoop, ''),
                    onCommit: (next) =>
                        commit('ambientLoop', next === '' ? undefined : next, 'Set ambient loop'),
                },
            ];

        case 'floor-transition': {
            const floors = state.map.floors ?? [];
            const floorOptions = floors.map((f) => ({ value: f.id, label: f.label || f.id }));
            return [
                {
                    key: 'meta.fromFloorId',
                    label: 'From floor',
                    type: 'enum',
                    value: stringOr(meta.fromFloorId, ''),
                    options: [{ value: '', label: '(none)' }, ...floorOptions],
                    onCommit: (next) =>
                        commit('fromFloorId', next === '' ? undefined : next, 'Set fromFloorId'),
                },
                {
                    key: 'meta.toFloorId',
                    label: 'To floor',
                    type: 'enum',
                    value: stringOr(meta.toFloorId, ''),
                    options: [{ value: '', label: '(none)' }, ...floorOptions],
                    onCommit: (next) =>
                        commit('toFloorId', next === '' ? undefined : next, 'Set toFloorId'),
                },
                {
                    key: 'meta.direction',
                    label: 'Direction',
                    type: 'enum',
                    value: stringOr(meta.direction, 'both'),
                    options: [
                        { value: 'up', label: 'up' },
                        { value: 'down', label: 'down' },
                        { value: 'both', label: 'both' },
                    ],
                    onCommit: (next) => commit('direction', next, 'Set transition direction'),
                },
            ];
        }

        case 'extract':
            return [];
    }
}

function stringOr(v: unknown, fallback: string): string {
    return typeof v === 'string' ? v : fallback;
}

function numberOr(v: unknown, fallback: number): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function polygonCentroid(poly: { x: number; y: number }[]): { x: number; y: number } {
    if (poly.length === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (const v of poly) {
        sx += v.x;
        sy += v.y;
    }
    return { x: sx / poly.length, y: sy / poly.length };
}
