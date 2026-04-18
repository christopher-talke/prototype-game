/**
 * Light placement tool. Click-drag sets the light radius; release commits a
 * LightPlacement with sane omnidirectional defaults (coneAngle = 2pi). Cone
 * editing happens in the right-panel lightForm after placement. Minimum
 * radius is 16 world px; below that, the gesture cancels silently.
 *
 * Part of the editor layer.
 */

import { Graphics, type Container } from 'pixi.js';

import type { Vec2 } from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import { buildCreateLightCommand } from '../commands/createLightCommand';
import type { SelectionStore } from '../selection/selectionStore';
import type { SnapService } from '../snap/SnapService';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { CURSORS } from './cursors';
import type { Tool, ToolKeyEvent, ToolPointerEvent } from './tool';
import type { ToolManager } from './toolManager';

export interface LightToolDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
    snap: SnapService;
    overlayParent: Container;
    toolManager: ToolManager;
}

type Gesture = { pointerId: number; anchor: Vec2; cursor: Vec2 } | null;

const MIN_RADIUS = 16;
const PREVIEW_COLOR = 0xfff0c4;

export class LightTool implements Tool {
    readonly id = 'light';
    readonly cursor = CURSORS.crosshair;

    private gesture: Gesture = null;
    private overlay = new Graphics();

    constructor(private readonly deps: LightToolDeps) {
        this.overlay.label = 'editor.lightTool';
        this.deps.overlayParent.addChild(this.overlay);
    }

    activate(): void {
        this.cancel();
    }

    deactivate(): void {
        this.cancel();
    }

    onPointerDown(e: ToolPointerEvent): void {
        if (e.native.button !== 0) return;
        const pt = this.snapPoint(e.worldX, e.worldY);
        this.gesture = { pointerId: e.native.pointerId, anchor: pt, cursor: pt };
        this.redraw();
    }

    onPointerMove(e: ToolPointerEvent): void {
        if (!this.gesture) return;
        this.gesture.cursor = this.snapPoint(e.worldX, e.worldY);
        this.redraw();
    }

    onPointerUp(e: ToolPointerEvent): void {
        if (!this.gesture || this.gesture.pointerId !== e.native.pointerId) return;
        const { anchor, cursor } = this.gesture;
        const radius = distance(anchor, cursor);
        if (radius < MIN_RADIUS) {
            this.cancel();
            return;
        }
        this.commit(anchor, radius);
    }

    onKeyDown(e: ToolKeyEvent): void {
        if (e.native.key !== 'Escape') return;
        if (this.gesture) {
            this.cancel();
            return;
        }
        this.deps.toolManager.activate('select');
    }

    onContextMenu(e: ToolPointerEvent): void {
        if (this.gesture) {
            e.native.preventDefault();
            this.cancel();
        }
    }

    private snapPoint(x: number, y: number): Vec2 {
        return this.deps.snap.snapToGrid(x, y);
    }

    private cancel(): void {
        this.gesture = null;
        this.overlay.clear();
    }

    private commit(anchor: Vec2, radius: number): void {
        const { state, stack, selection } = this.deps;
        const layerId = state.activeLayerId;
        if (!layerId) {
            this.cancel();
            return;
        }
        const result = buildCreateLightCommand(state, layerId, anchor, radius);
        if (!result) {
            this.cancel();
            return;
        }
        stack.dispatch(result.command);
        selection.select(result.newGuid);
        this.cancel();
    }

    private redraw(): void {
        const g = this.overlay;
        g.clear();
        if (!this.gesture) return;
        const { anchor, cursor } = this.gesture;
        const radius = distance(anchor, cursor);
        g.circle(anchor.x, anchor.y, Math.max(radius, 1))
            .fill({ color: PREVIEW_COLOR, alpha: 0.12 })
            .stroke({ color: PREVIEW_COLOR, width: 1, alpha: 0.8 });
        g.rect(anchor.x - 3, anchor.y - 3, 6, 6).fill({ color: PREVIEW_COLOR, alpha: 1 });
    }
}

function distance(a: Vec2, b: Vec2): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}
