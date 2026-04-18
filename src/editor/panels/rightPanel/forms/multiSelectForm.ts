/**
 * Multi-select property form. Common transform fields applied as deltas
 * to every selected item. When every selection shares the same kind,
 * kind-specific shared fields are appended (walls: type + solid/penetrable/
 * occludes; zones: type + label + team). Edits dispatch a single
 * batched SnapshotCommand covering all GUIDs.
 *
 * Part of the editor layer.
 */

import type { Wall, WallType, Zone, ZoneType } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState, ItemKind, ItemRef } from '../../../state/EditorWorkingState';
import { buildTransformCommand } from '../../../commands/transformCommand';
import { buildBatchSetPropertyCommand } from '../../../commands/batchSetPropertyCommand';
import { unionBounds } from '../../../selection/boundsOf';
import type { FieldDescriptor } from '../fieldDescriptor';

const WALL_TYPES: WallType[] = ['concrete', 'metal', 'crate', 'sandbag', 'barrier', 'pillar'];

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

/** Build the field list for a multi-selection. */
export function multiSelectFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    refs: ItemRef[],
): FieldDescriptor[] {
    const guids = refs.map((r) => r.guid);
    const union = unionBounds(state, guids);
    const cx = union.x + union.width / 2;
    const cy = union.y + union.height / 2;

    const fields: FieldDescriptor[] = [];
    fields.push({
        key: 'count',
        label: 'Selected',
        type: 'readonly',
        value: `${refs.length} items`,
    });
    fields.push({
        key: 'centerX',
        label: 'Center X',
        type: 'number',
        value: cx,
        step: 1,
        onCommit: (next) => {
            const dx = next - cx;
            if (dx === 0) return;
            const cmd = buildTransformCommand(
                state,
                guids.map((g) => ({ guid: g, dx })),
            );
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'centerY',
        label: 'Center Y',
        type: 'number',
        value: cy,
        step: 1,
        onCommit: (next) => {
            const dy = next - cy;
            if (dy === 0) return;
            const cmd = buildTransformCommand(
                state,
                guids.map((g) => ({ guid: g, dy })),
            );
            if (cmd) stack.dispatch(cmd);
        },
    });

    const sharedKind = homogeneousKind(refs);
    if (sharedKind) {
        fields.push(...sharedFieldsFor(sharedKind, state, stack, refs));
    }

    return fields;
}

function homogeneousKind(refs: ItemRef[]): ItemKind | null {
    if (refs.length === 0) return null;
    const first = refs[0].kind;
    for (const r of refs) {
        if (r.kind !== first) return null;
    }
    return first;
}

function sharedFieldsFor(
    kind: ItemKind,
    state: EditorWorkingState,
    stack: CommandStack,
    refs: ItemRef[],
): FieldDescriptor[] {
    const guids = refs.map((r) => r.guid);
    switch (kind) {
        case 'wall':
            return sharedWallFields(state, stack, guids);
        case 'zone':
            return sharedZoneFields(state, stack, guids);
        default:
            return [];
    }
}

function sharedWallFields(
    state: EditorWorkingState,
    stack: CommandStack,
    guids: string[],
): FieldDescriptor[] {
    const walls = guids
        .map((g) => findWall(state, g))
        .filter((w): w is Wall => w !== null);
    if (walls.length === 0) return [];
    const wallType = sharedValue(walls.map((w) => w.wallType));
    const solid = sharedValue(walls.map((w) => w.solid));
    const penetrable = sharedValue(walls.map((w) => w.bulletPenetrable));
    const occludes = sharedValue(walls.map((w) => w.occludesVision));

    const fields: FieldDescriptor[] = [];

    fields.push({
        key: 'shared.wallType',
        label: 'Wall type',
        type: 'enum',
        value: wallType ?? '',
        options: [
            ...(wallType === null ? [{ value: '', label: '(mixed)' }] : []),
            ...WALL_TYPES.map((t) => ({ value: t, label: t })),
        ],
        onCommit: (next) => {
            if (next === '') return;
            const cmd = buildBatchSetPropertyCommand(
                state,
                guids,
                ['wallType'],
                next,
                `Set wallType (${guids.length})`,
            );
            if (cmd) stack.dispatch(cmd);
        },
    });

    fields.push({
        key: 'shared.solid',
        label: 'Solid',
        type: 'bool',
        value: solid ?? false,
        onCommit: (next) => {
            const cmd = buildBatchSetPropertyCommand(
                state,
                guids,
                ['solid'],
                next,
                `Set solid (${guids.length})`,
            );
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'shared.bulletPenetrable',
        label: 'Bullet penetrable',
        type: 'bool',
        value: penetrable ?? false,
        onCommit: (next) => {
            const cmd = buildBatchSetPropertyCommand(
                state,
                guids,
                ['bulletPenetrable'],
                next,
                `Set penetrable (${guids.length})`,
            );
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'shared.occludesVision',
        label: 'Occludes vision',
        type: 'bool',
        value: occludes ?? false,
        onCommit: (next) => {
            const cmd = buildBatchSetPropertyCommand(
                state,
                guids,
                ['occludesVision'],
                next,
                `Set occludesVision (${guids.length})`,
            );
            if (cmd) stack.dispatch(cmd);
        },
    });

    return fields;
}

function sharedZoneFields(
    state: EditorWorkingState,
    stack: CommandStack,
    guids: string[],
): FieldDescriptor[] {
    const zones = guids
        .map((g) => state.map.zones.find((z) => z.id === g) ?? null)
        .filter((z): z is Zone => z !== null);
    if (zones.length === 0) return [];
    const zoneType = sharedValue(zones.map((z) => z.type));
    const team = sharedValue(zones.map((z) => z.team ?? ''));

    const fields: FieldDescriptor[] = [];

    fields.push({
        key: 'shared.zoneType',
        label: 'Zone type',
        type: 'enum',
        value: zoneType ?? '',
        options: [
            ...(zoneType === null ? [{ value: '', label: '(mixed)' }] : []),
            ...ZONE_TYPES.map((t) => ({ value: t, label: t })),
        ],
        onCommit: (next) => {
            if (next === '') return;
            const cmd = buildBatchSetPropertyCommand(
                state,
                guids,
                ['type'],
                next,
                `Set zone type (${guids.length})`,
            );
            if (cmd) stack.dispatch(cmd);
        },
    });

    fields.push({
        key: 'shared.team',
        label: 'Team',
        type: 'text',
        value: team ?? '',
        onCommit: (next) => {
            const cmd = buildBatchSetPropertyCommand(
                state,
                guids,
                ['team'],
                next === '' ? undefined : next,
                `Set zone team (${guids.length})`,
            );
            if (cmd) stack.dispatch(cmd);
        },
    });

    return fields;
}

function findWall(state: EditorWorkingState, guid: string): Wall | null {
    for (const layer of state.map.layers) {
        for (const w of layer.walls) {
            if (w.id === guid) return w;
        }
    }
    return null;
}

function sharedValue<T>(values: T[]): T | null {
    if (values.length === 0) return null;
    const first = values[0];
    for (const v of values) {
        if (v !== first) return null;
    }
    return first;
}
