/**
 * Common transform-row builders. Used by per-kind forms.
 *
 * Position: emits two number fields (X, Y) that commit by computing
 * `dx` / `dy` deltas and dispatching a TransformCommand. Rotation: emits
 * one number field that computes a rotation delta.
 *
 * Part of the editor layer.
 */

import type { CommandStack } from '../../commands/CommandStack';
import type { EditorWorkingState } from '../../state/EditorWorkingState';
import { buildTransformCommand } from '../../commands/transformCommand';
import type { FieldDescriptor } from './fieldDescriptor';

export interface TransformContext {
    state: EditorWorkingState;
    stack: CommandStack;
    guid: string;
}

/** Build position fields (X, Y) that commit as transform deltas. */
export function positionFields(ctx: TransformContext, current: { x: number; y: number }): FieldDescriptor[] {
    return [
        {
            key: 'x',
            label: 'Position X',
            type: 'number',
            value: current.x,
            step: 1,
            onCommit: (next) => commitTransform(ctx, { dx: next - current.x }),
        },
        {
            key: 'y',
            label: 'Position Y',
            type: 'number',
            value: current.y,
            step: 1,
            onCommit: (next) => commitTransform(ctx, { dy: next - current.y }),
        },
    ];
}

/** Build a rotation field (radians) that commits as a transform delta. */
export function rotationField(ctx: TransformContext, current: number): FieldDescriptor {
    return {
        key: 'rotation',
        label: 'Rotation (rad)',
        type: 'number',
        value: current,
        step: 0.01,
        onCommit: (next) => commitTransform(ctx, { dRotation: next - current }),
    };
}

/** Build scale fields (X, Y) that commit as multipliers. */
export function scaleFields(ctx: TransformContext, current: { x: number; y: number }): FieldDescriptor[] {
    return [
        {
            key: 'scaleX',
            label: 'Scale X',
            type: 'number',
            value: current.x,
            step: 0.05,
            onCommit: (next) => {
                if (current.x === 0) return;
                commitTransform(ctx, { scaleMultiplier: { x: next / current.x, y: 1 } });
            },
        },
        {
            key: 'scaleY',
            label: 'Scale Y',
            type: 'number',
            value: current.y,
            step: 0.05,
            onCommit: (next) => {
                if (current.y === 0) return;
                commitTransform(ctx, { scaleMultiplier: { x: 1, y: next / current.y } });
            },
        },
    ];
}

interface DeltaPart {
    dx?: number;
    dy?: number;
    dRotation?: number;
    scaleMultiplier?: { x: number; y: number };
}

function commitTransform(ctx: TransformContext, delta: DeltaPart): void {
    const cmd = buildTransformCommand(ctx.state, [{ guid: ctx.guid, ...delta }]);
    if (cmd) ctx.stack.dispatch(cmd);
}
