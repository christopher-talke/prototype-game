/**
 * Selection / move / rotate / scale tool.
 *
 * Click an item to select it; shift-click to extend; click empty space to
 * clear. Click+drag on empty space draws a box-select rectangle. Click+drag
 * on a selected item starts a move drag. Drag corner/edge handles to scale;
 * drag the rotation handle to rotate.
 *
 * Locked-layer items can't be selected; behind-glass (non-active layer) items
 * have eventMode='none' so this tool's hit-test won't return them either.
 *
 * Part of the editor layer.
 */

import { Graphics, type Container } from 'pixi.js';

import type { CommandStack } from '../commands/CommandStack';
import { buildDeleteItemsCommand } from '../commands/deleteItemsCommand';
import type { DragController } from '../drag/dragController';
import type { EditorMapRenderer } from '../rendering/editorMapRenderer';
import type { SelectionStore } from '../selection/selectionStore';
import type { GroupEnterState } from '../selection/groupEnterState';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { aabbContains, boundsOfGUID, unionBounds, type AABB } from '../selection/boundsOf';
import { findTopmostGroup, groupMembersFlattened } from '../groups/groupQueries';
import { isItemLocked } from '../state/itemLockQuery';
import type { EditorCamera } from '../viewport/EditorCamera';
import { hitTestHandle } from '../gizmos/handleHitTest';
import { type HandleId } from '../gizmos/transformHandles';
import { DoubleClickTracker } from '../input/DoubleClickTracker';
import { CURSORS } from './cursors';
import type { Tool, ToolKeyEvent, ToolPointerEvent } from './tool';
import type { ToolManager } from './toolManager';

interface BoxSelectState {
    pointerId: number;
    additive: boolean;
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
}

export interface SelectToolDeps {
    state: EditorWorkingState;
    selection: SelectionStore;
    groupEnter: GroupEnterState;
    renderer: EditorMapRenderer;
    drag: DragController;
    stack: CommandStack;
    camera: EditorCamera;
    overlayParent: Container;
    canvasEl: HTMLCanvasElement;
    toolManager: ToolManager;
}

export class SelectTool implements Tool {
    readonly id = 'select';
    readonly cursor = CURSORS.select;

    private box: BoxSelectState | null = null;
    private boxGraphics = new Graphics();
    private doubleClick = new DoubleClickTracker();

    constructor(private readonly deps: SelectToolDeps) {
        this.boxGraphics.label = 'editor.boxSelect';
        this.deps.overlayParent.addChild(this.boxGraphics);
    }

    activate(): void {
        // no-op; SelectTool has no activation args
    }

    deactivate(): void {
        this.box = null;
        this.boxGraphics.clear();
    }

    onPointerDown(e: ToolPointerEvent): void {
        if (e.native.button !== 0) return;
        const { selection, renderer, drag, camera, state, groupEnter } = this.deps;

        const guids = selection.selectedArray();
        if (guids.length >= 1) {
            const aabb = guids.length === 1
                ? boundsOfGUID(state, guids[0])
                : unionBounds(state, guids);
            const handle = hitTestHandle(aabb, camera.zoom, e.worldX, e.worldY);
            if (handle === 'rotate') {
                const pivotX = aabb.x + aabb.width / 2;
                const pivotY = aabb.y + aabb.height / 2;
                drag.startRotate(e.native.pointerId, e.worldX, e.worldY, guids, pivotX, pivotY);
                return;
            }
            if (handle && handle !== 'pivot' && isScaleHandle(handle)) {
                const info = scaleInfo(handle, aabb);
                drag.startScale(
                    e.native.pointerId,
                    guids,
                    info.pivotX, info.pivotY,
                    info.handleX, info.handleY,
                    info.axis,
                );
                return;
            }
            if (handle === null || handle === 'pivot') {
                // fall through to move/item hit-test
            }
        }

        const hit = renderer.hitTest(e.worldX, e.worldY);
        const additive = e.native.shiftKey;
        const isDoubleClick = hit !== null && this.doubleClick.record(e.screenX, e.screenY);
        const hitLocked = hit !== null && isItemLocked(state, hit);

        if (hit) {
            const topGroup = findTopmostGroup(state, hit);
            const entered = groupEnter.enteredId();

            if (isDoubleClick && topGroup && topGroup.id !== entered) {
                groupEnter.enter(topGroup.id);
                selection.select(hit);
                return;
            }

            if (isDoubleClick && isPolygonHit(state, hit)) {
                selection.select(hit);
                this.deps.toolManager.activate('vertexEdit', { targetGuid: hit });
                return;
            }

            if (topGroup && topGroup.id !== entered && !isInsideEntered(state, hit, entered)) {
                const flat = groupMembersFlattened(state, topGroup.id);
                if (additive) {
                    selection.selectMany(flat, true);
                } else {
                    selection.selectMany(flat);
                }
                if (!hitLocked) {
                    drag.startMove(e.native.pointerId, e.worldX, e.worldY, selection.selectedArray());
                }
                return;
            }

            if (additive) {
                selection.toggle(hit);
                return;
            }
            if (selection.has(hit)) {
                if (!hitLocked) {
                    drag.startMove(e.native.pointerId, e.worldX, e.worldY, selection.selectedArray());
                }
                return;
            }
            selection.select(hit);
            if (!hitLocked) {
                drag.startMove(e.native.pointerId, e.worldX, e.worldY, selection.selectedArray());
            }
            return;
        }

        if (!additive) {
            groupEnter.exit();
            selection.clear();
        }
        this.box = {
            pointerId: e.native.pointerId,
            additive,
            startWorldX: e.worldX,
            startWorldY: e.worldY,
            currentWorldX: e.worldX,
            currentWorldY: e.worldY,
        };
    }

    onPointerMove(e: ToolPointerEvent): void {
        const { drag } = this.deps;
        if (drag.isActive()) {
            drag.update(e.native.pointerId, e.worldX, e.worldY, e.native.shiftKey);
            this.deps.canvasEl.style.cursor = CURSORS.grabbing;
            return;
        }
        if (this.box && this.box.pointerId === e.native.pointerId) {
            this.box.currentWorldX = e.worldX;
            this.box.currentWorldY = e.worldY;
            this.drawBox();
            return;
        }
        this.updateCursor(e.worldX, e.worldY);
    }

    onPointerUp(e: ToolPointerEvent): void {
        const { drag } = this.deps;
        if (drag.isActive()) {
            drag.commit(e.native.pointerId, e.worldX, e.worldY, e.native.shiftKey);
            this.updateCursor(e.worldX, e.worldY);
            return;
        }
        if (this.box && this.box.pointerId === e.native.pointerId) {
            this.commitBoxSelect();
            this.box = null;
            this.boxGraphics.clear();
        }
    }

    onKeyDown(e: ToolKeyEvent): void {
        const key = e.native.key;
        if (key === 'Escape') {
            if (this.deps.drag.isActive()) {
                this.deps.drag.cancel();
                this.updateCursor(0, 0);
            }
            if (this.box) {
                this.box = null;
                this.boxGraphics.clear();
            }
            if (this.deps.groupEnter.enteredId() !== null) {
                this.deps.groupEnter.exit();
            }
            return;
        }
        if (key === 'Delete' || key === 'Backspace') {
            this.deleteSelection();
            return;
        }
    }

    /** Bbox enclosing all selected items (for tools/UI that need it). */
    selectionBounds(): AABB {
        return unionBounds(this.deps.state, this.deps.selection.selectedArray());
    }

    private updateCursor(worldX: number, worldY: number): void {
        const { selection, state, renderer, camera, canvasEl } = this.deps;
        const guids = selection.selectedArray();
        if (guids.length >= 1) {
            const aabb = guids.length === 1
                ? boundsOfGUID(state, guids[0])
                : unionBounds(state, guids);
            const handle = hitTestHandle(aabb, camera.zoom, worldX, worldY);
            if (handle) {
                canvasEl.style.cursor = cursorForHandle(handle);
                return;
            }
        }
        const hit = renderer.hitTest(worldX, worldY);
        canvasEl.style.cursor = hit ? CURSORS.move : CURSORS.select;
    }

    private drawBox(): void {
        if (!this.box) return;
        const { startWorldX, startWorldY, currentWorldX, currentWorldY } = this.box;
        const x = Math.min(startWorldX, currentWorldX);
        const y = Math.min(startWorldY, currentWorldY);
        const w = Math.abs(currentWorldX - startWorldX);
        const h = Math.abs(currentWorldY - startWorldY);
        this.boxGraphics.clear();
        this.boxGraphics
            .rect(x, y, w, h)
            .fill({ color: 0x00e5ff, alpha: 0.06 })
            .stroke({ color: 0x00e5ff, width: 1, alpha: 0.5 });
    }

    private commitBoxSelect(): void {
        if (!this.box) return;
        const { selection, state } = this.deps;
        const x = Math.min(this.box.startWorldX, this.box.currentWorldX);
        const y = Math.min(this.box.startWorldY, this.box.currentWorldY);
        const w = Math.abs(this.box.currentWorldX - this.box.startWorldX);
        const h = Math.abs(this.box.currentWorldY - this.box.startWorldY);
        const outer: AABB = { x, y, width: w, height: h };
        if (w === 0 && h === 0) return;

        const candidates: string[] = [];
        const activeLayer = state.activeLayerId;
        const layer = state.map.layers.find((l) => l.id === activeLayer);
        if (layer && !layer.locked) {
            const onLayer = state.byLayer.get(activeLayer);
            if (onLayer) {
                for (const guid of onLayer) {
                    const inner = boundsOfGUID(state, guid);
                    if (inner.width === 0 && inner.height === 0) continue;
                    if (aabbContains(outer, inner)) candidates.push(guid);
                }
            }
        }
        if (candidates.length > 0) selection.selectMany(candidates, this.box.additive);
    }

    private deleteSelection(): void {
        const guids = this.deps.selection.selectedArray();
        const cmd = buildDeleteItemsCommand(this.deps.state, guids);
        if (cmd) this.deps.stack.dispatch(cmd);
    }
}

/**
 * True when `guid` is part of the flattened membership of `enteredGroupId`,
 * meaning the user has already "entered" its parent group so further clicks
 * should treat members individually.
 */
function isInsideEntered(
    state: EditorWorkingState,
    guid: string,
    enteredGroupId: string | null,
): boolean {
    if (!enteredGroupId) return false;
    return groupMembersFlattened(state, enteredGroupId).includes(guid);
}

function isPolygonHit(state: EditorWorkingState, guid: string): boolean {
    const ref = state.byGUID.get(guid);
    if (!ref) return false;
    return ref.kind === 'wall' || ref.kind === 'zone';
}

function isScaleHandle(h: HandleId): boolean {
    return h === 'corner-tl' || h === 'corner-tr' || h === 'corner-bl' || h === 'corner-br'
        || h === 'edge-t' || h === 'edge-r' || h === 'edge-b' || h === 'edge-l';
}

function scaleInfo(handleId: HandleId, aabb: AABB): {
    pivotX: number; pivotY: number;
    handleX: number; handleY: number;
    axis: 'x' | 'y' | 'xy';
} {
    const left = aabb.x;
    const right = aabb.x + aabb.width;
    const top = aabb.y;
    const bottom = aabb.y + aabb.height;
    const cx = aabb.x + aabb.width / 2;
    const cy = aabb.y + aabb.height / 2;
    switch (handleId) {
        case 'corner-tl': return { pivotX: right, pivotY: bottom, handleX: left, handleY: top, axis: 'xy' };
        case 'corner-tr': return { pivotX: left, pivotY: bottom, handleX: right, handleY: top, axis: 'xy' };
        case 'corner-bl': return { pivotX: right, pivotY: top, handleX: left, handleY: bottom, axis: 'xy' };
        case 'corner-br': return { pivotX: left, pivotY: top, handleX: right, handleY: bottom, axis: 'xy' };
        case 'edge-t':    return { pivotX: cx, pivotY: bottom, handleX: cx, handleY: top, axis: 'y' };
        case 'edge-b':    return { pivotX: cx, pivotY: top, handleX: cx, handleY: bottom, axis: 'y' };
        case 'edge-l':    return { pivotX: right, pivotY: cy, handleX: left, handleY: cy, axis: 'x' };
        case 'edge-r':    return { pivotX: left, pivotY: cy, handleX: right, handleY: cy, axis: 'x' };
        default:          return { pivotX: cx, pivotY: cy, handleX: cx + 1, handleY: cy, axis: 'xy' };
    }
}

function cursorForHandle(handle: HandleId): string {
    switch (handle) {
        case 'corner-tl': case 'corner-br': return CURSORS.nwse;
        case 'corner-tr': case 'corner-bl': return CURSORS.nesw;
        case 'edge-t': case 'edge-b': return CURSORS.ns;
        case 'edge-l': case 'edge-r': return CURSORS.ew;
        case 'rotate': return CURSORS.rotate;
        case 'pivot': return CURSORS.crosshair;
    }
}
