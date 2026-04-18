/**
 * Wall property form. Wall has a polygon (vertices), wallType, and
 * physics flags. Rotation and size scale all vertices around the centroid.
 *
 * Part of the editor layer.
 */

import type { Vec2, Wall, WallType } from '@shared/map/MapData';

import type { CommandStack } from '../../../commands/CommandStack';
import type { EditorWorkingState } from '../../../state/EditorWorkingState';
import { buildSetPropertyCommand } from '../../../commands/setPropertyCommand';
import { buildTransformCommand } from '../../../commands/transformCommand';
import type { FieldDescriptor } from '../fieldDescriptor';
import { positionFields } from '../transformSection';

const WALL_TYPES: WallType[] = ['concrete', 'metal', 'crate', 'sandbag', 'barrier', 'pillar'];

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/** Build the field list for a wall. */
export function wallFormFields(
    state: EditorWorkingState,
    stack: CommandStack,
    wall: Wall,
): FieldDescriptor[] {
    const centroid = wallCentroid(wall.vertices);
    const aabb = wallAABB(wall.vertices);
    const angleDeg = wallAngleDeg(wall.vertices);
    const fields: FieldDescriptor[] = [];

    fields.push({
        key: 'wallType',
        label: 'Wall type',
        type: 'enum',
        value: wall.wallType,
        options: WALL_TYPES.map((t) => ({ value: t, label: t })),
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, wall.id, ['wallType'], next, 'Set wall type');
            if (cmd) stack.dispatch(cmd);
        },
    });

    fields.push(...positionFields({ state, stack, guid: wall.id }, centroid));

    fields.push({
        key: 'rotation',
        label: 'Rotation (°)',
        type: 'number',
        value: Math.round(angleDeg * 10) / 10,
        step: 1,
        onCommit: (next) => {
            const dRotation = (next - angleDeg) * DEG_TO_RAD;
            if (dRotation === 0) return;
            const cmd = buildTransformCommand(state, [{ guid: wall.id, dRotation, pivot: centroid }]);
            if (cmd) stack.dispatch(cmd);
        },
    });

    if (aabb.w > 0) {
        fields.push({
            key: 'width',
            label: 'Width',
            type: 'number',
            value: Math.round(aabb.w),
            step: 1,
            min: 1,
            onCommit: (next) => {
                if (next <= 0 || aabb.w === 0) return;
                const cmd = buildTransformCommand(state, [{
                    guid: wall.id,
                    scaleMultiplier: { x: next / aabb.w, y: 1 },
                    pivot: centroid,
                }]);
                if (cmd) stack.dispatch(cmd);
            },
        });
    }

    if (aabb.h > 0) {
        fields.push({
            key: 'height',
            label: 'Height',
            type: 'number',
            value: Math.round(aabb.h),
            step: 1,
            min: 1,
            onCommit: (next) => {
                if (next <= 0 || aabb.h === 0) return;
                const cmd = buildTransformCommand(state, [{
                    guid: wall.id,
                    scaleMultiplier: { x: 1, y: next / aabb.h },
                    pivot: centroid,
                }]);
                if (cmd) stack.dispatch(cmd);
            },
        });
    }

    fields.push({
        key: 'vertexCount',
        label: 'Vertices',
        type: 'readonly',
        value: String(wall.vertices.length),
    });

    fields.push({
        key: 'solid',
        label: 'Solid',
        type: 'bool',
        value: wall.solid,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, wall.id, ['solid'], next, 'Set solid');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'bulletPenetrable',
        label: 'Bullet penetrable',
        type: 'bool',
        value: wall.bulletPenetrable,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, wall.id, ['bulletPenetrable'], next, 'Set penetrable');
            if (cmd) stack.dispatch(cmd);
        },
    });
    fields.push({
        key: 'occludesVision',
        label: 'Occludes vision',
        type: 'bool',
        value: wall.occludesVision,
        onCommit: (next) => {
            const cmd = buildSetPropertyCommand(state, wall.id, ['occludesVision'], next, 'Set occludesVision');
            if (cmd) stack.dispatch(cmd);
        },
    });

    return fields;
}

function wallCentroid(vertices: Vec2[]): Vec2 {
    if (vertices.length === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (const v of vertices) {
        sx += v.x;
        sy += v.y;
    }
    return { x: sx / vertices.length, y: sy / vertices.length };
}

function wallAABB(vertices: Vec2[]): { w: number; h: number } {
    if (vertices.length === 0) return { w: 0, h: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const v of vertices) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    return { w: maxX - minX, h: maxY - minY };
}

/** Angle of the first edge (v0 → v1) in degrees. 0 = horizontal. */
function wallAngleDeg(vertices: Vec2[]): number {
    if (vertices.length < 2) return 0;
    const dx = vertices[1].x - vertices[0].x;
    const dy = vertices[1].y - vertices[0].y;
    return Math.atan2(dy, dx) * RAD_TO_DEG;
}
