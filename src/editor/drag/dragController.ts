/**
 * Owns a drag session: move, rotate, or scale from pointerdown to pointerup,
 * with cancel-on-Escape support.
 *
 * Updates DragOverlay every pointermove; on commit, dispatches one
 * TransformCommand. Pointer capture on the canvas keeps the drag alive when
 * the cursor leaves the viewport.
 *
 * Part of the editor layer.
 */

import type { CommandStack } from '../commands/CommandStack';
import { buildTransformCommand } from '../commands/transformCommand';
import type { ItemTransformDelta } from '../commands/mapMutators';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { SnapService } from '../snap/SnapService';
import type { DragOverlay } from './dragOverlay';

const DEG15 = Math.PI / 12;

interface MoveDrag {
    kind: 'move';
    pointerId: number;
    startX: number;
    startY: number;
    guids: string[];
}

interface RotateDrag {
    kind: 'rotate';
    pointerId: number;
    pivotX: number;
    pivotY: number;
    initialAngle: number;
    lastDRotation: number;
    guids: string[];
}

interface ScaleDrag {
    kind: 'scale';
    pointerId: number;
    pivotX: number;
    pivotY: number;
    /** initialDist in each axis from pivot to handle (may be negative). */
    initialDistX: number;
    initialDistY: number;
    axis: 'x' | 'y' | 'xy';
    lastScaleX: number;
    lastScaleY: number;
    guids: string[];
}

type ActiveDrag = MoveDrag | RotateDrag | ScaleDrag;

export class DragController {
    private active: ActiveDrag | null = null;

    constructor(
        private readonly state: EditorWorkingState,
        private readonly overlay: DragOverlay,
        private readonly stack: CommandStack,
        private readonly target: HTMLElement,
        private readonly snap: SnapService,
    ) {}

    isActive(): boolean {
        return this.active !== null;
    }

    /** Begin a translation drag for the supplied guids. */
    startMove(pointerId: number, worldX: number, worldY: number, guids: string[]): void {
        if (guids.length === 0) return;
        const snapStart = this.snap.snapToGrid(worldX, worldY);
        this.active = { kind: 'move', pointerId, startX: snapStart.x, startY: snapStart.y, guids: [...guids] };
        this.overlay.setMany(guids, { dx: 0, dy: 0, dRotation: 0, scaleX: 1, scaleY: 1 });
        this.capture(pointerId);
    }

    /** Begin a rotation drag around `(pivotX, pivotY)` for the supplied guids. */
    startRotate(
        pointerId: number,
        worldX: number,
        worldY: number,
        guids: string[],
        pivotX: number,
        pivotY: number,
    ): void {
        if (guids.length === 0) return;
        const initialAngle = Math.atan2(worldY - pivotY, worldX - pivotX);
        this.active = { kind: 'rotate', pointerId, pivotX, pivotY, initialAngle, lastDRotation: 0, guids: [...guids] };
        this.overlay.setMany(guids, { dx: 0, dy: 0, dRotation: 0, scaleX: 1, scaleY: 1, pivotX, pivotY });
        this.capture(pointerId);
    }

    /**
     * Begin a scale drag.
     * `initialHandleX/Y` is the world position of the handle being dragged.
     * `pivotX/Y` is the opposite anchor (stays fixed).
     * `axis` controls which scale dimensions are live.
     */
    startScale(
        pointerId: number,
        guids: string[],
        pivotX: number,
        pivotY: number,
        initialHandleX: number,
        initialHandleY: number,
        axis: 'x' | 'y' | 'xy',
    ): void {
        if (guids.length === 0) return;
        this.active = {
            kind: 'scale',
            pointerId,
            pivotX,
            pivotY,
            initialDistX: initialHandleX - pivotX,
            initialDistY: initialHandleY - pivotY,
            axis,
            lastScaleX: 1,
            lastScaleY: 1,
            guids: [...guids],
        };
        this.overlay.setMany(guids, { dx: 0, dy: 0, dRotation: 0, scaleX: 1, scaleY: 1, pivotX, pivotY });
        this.capture(pointerId);
    }

    update(pointerId: number, worldX: number, worldY: number, shiftKey = false): void {
        if (!this.active || this.active.pointerId !== pointerId) return;

        if (this.active.kind === 'move') {
            const snapped = this.snap.snapToGrid(worldX, worldY);
            const dx = snapped.x - this.active.startX;
            const dy = snapped.y - this.active.startY;
            this.overlay.update({ dx, dy });
            return;
        }

        if (this.active.kind === 'rotate') {
            const { pivotX, pivotY } = this.active;
            let dRotation = Math.atan2(worldY - pivotY, worldX - pivotX) - this.active.initialAngle;
            if (shiftKey) dRotation = Math.round(dRotation / DEG15) * DEG15;
            this.active.lastDRotation = dRotation;
            this.overlay.update({ dRotation });
            return;
        }

        if (this.active.kind === 'scale') {
            const { pivotX, pivotY, initialDistX, initialDistY, axis } = this.active;
            const snapped = this.snap.snapToGrid(worldX, worldY);
            let scaleX = 1;
            let scaleY = 1;
            if (axis !== 'y' && initialDistX !== 0) {
                scaleX = Math.max(0.01, (snapped.x - pivotX) / initialDistX);
            }
            if (axis !== 'x' && initialDistY !== 0) {
                scaleY = Math.max(0.01, (snapped.y - pivotY) / initialDistY);
            }
            if (shiftKey && axis === 'xy') {
                const s = Math.min(scaleX, scaleY);
                scaleX = s;
                scaleY = s;
            }
            this.active.lastScaleX = scaleX;
            this.active.lastScaleY = scaleY;
            this.overlay.update({ scaleX, scaleY });
            return;
        }
    }

    commit(pointerId: number, worldX: number, worldY: number, shiftKey = false): void {
        if (!this.active || this.active.pointerId !== pointerId) return;
        const active = this.active;
        this.release(pointerId);
        this.active = null;
        this.overlay.clear();

        let transforms: ItemTransformDelta[];

        if (active.kind === 'move') {
            const snapped = this.snap.snapToGrid(worldX, worldY);
            const dx = snapped.x - active.startX;
            const dy = snapped.y - active.startY;
            if (dx === 0 && dy === 0) return;
            transforms = active.guids.map((guid) => ({ guid, dx, dy }));
        } else if (active.kind === 'rotate') {
            let dRotation = Math.atan2(worldY - active.pivotY, worldX - active.pivotX) - active.initialAngle;
            if (shiftKey) dRotation = Math.round(dRotation / DEG15) * DEG15;
            if (dRotation === 0) return;
            const pivot = { x: active.pivotX, y: active.pivotY };
            transforms = active.guids.map((guid) => ({ guid, dRotation, pivot }));
        } else {
            const { pivotX, pivotY, initialDistX, initialDistY, axis } = active;
            const snapped = this.snap.snapToGrid(worldX, worldY);
            let scaleX = 1;
            let scaleY = 1;
            if (axis !== 'y' && initialDistX !== 0) {
                scaleX = Math.max(0.01, (snapped.x - pivotX) / initialDistX);
            }
            if (axis !== 'x' && initialDistY !== 0) {
                scaleY = Math.max(0.01, (snapped.y - pivotY) / initialDistY);
            }
            if (shiftKey && axis === 'xy') {
                const s = Math.min(scaleX, scaleY);
                scaleX = s;
                scaleY = s;
            }
            if (scaleX === 1 && scaleY === 1) return;
            const pivot = { x: pivotX, y: pivotY };
            transforms = active.guids.map((guid) => ({ guid, scaleMultiplier: { x: scaleX, y: scaleY }, pivot }));
        }

        const cmd = buildTransformCommand(this.state, transforms);
        if (cmd) this.stack.dispatch(cmd);
    }

    cancel(): void {
        if (!this.active) return;
        this.release(this.active.pointerId);
        this.active = null;
        this.overlay.clear();
    }

    private capture(pointerId: number): void {
        if (!this.target.hasPointerCapture(pointerId)) {
            try { this.target.setPointerCapture(pointerId); } catch { /* drag continues without capture */ }
        }
    }

    private release(pointerId: number): void {
        if (this.target.hasPointerCapture(pointerId)) {
            this.target.releasePointerCapture(pointerId);
        }
    }
}
