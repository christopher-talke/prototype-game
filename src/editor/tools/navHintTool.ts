/**
 * NavHint placement tool. Click-drag sets the radius; type and weight come
 * from ToolSettings.navHint. Preview ring colour by type; ring alpha/width
 * scales with weight. Commits via buildCreateNavHintCommand.
 *
 * Part of the editor layer.
 */

import { Graphics, type Container } from 'pixi.js';

import type { NavHintType, Vec2 } from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import { buildCreateNavHintCommand } from '../commands/createNavHintCommand';
import type { SelectionStore } from '../selection/selectionStore';
import type { SnapService } from '../snap/SnapService';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { CURSORS } from './cursors';
import type { Tool, ToolKeyEvent, ToolPointerEvent } from './tool';
import type { ToolManager } from './toolManager';
import type { ToolSettingsStore } from './toolSettings';

export interface NavHintToolDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
    snap: SnapService;
    overlayParent: Container;
    settings: ToolSettingsStore;
    toolManager: ToolManager;
}

type Gesture = { pointerId: number; anchor: Vec2; cursor: Vec2 } | null;

const MIN_RADIUS = 8;

const NAV_HINT_COLORS: Record<NavHintType, number> = {
    cover: 0x66ccff,
    choke: 0xff8844,
    flank: 0xaa66ff,
    danger: 0xff5050,
    objective: 0xffd24a,
};

export class NavHintTool implements Tool {
    readonly id = 'navHint';
    readonly cursor = CURSORS.crosshair;

    private gesture: Gesture = null;
    private overlay = new Graphics();

    constructor(private readonly deps: NavHintToolDeps) {
        this.overlay.label = 'editor.navHintTool';
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
        const { state, stack, selection, settings } = this.deps;
        const s = settings.get().navHint;
        const result = buildCreateNavHintCommand(state, s.type, anchor, radius, s.weight);
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
        const s = this.deps.settings.get().navHint;
        const colour = NAV_HINT_COLORS[s.type] ?? 0xffffff;
        const alpha = 0.3 + 0.5 * Math.max(0, Math.min(1, s.weight));

        g.circle(anchor.x, anchor.y, Math.max(radius, 1))
            .fill({ color: colour, alpha: alpha * 0.25 })
            .stroke({ color: colour, width: 1, alpha });
        g.rect(anchor.x - 3, anchor.y - 3, 6, 6).fill({ color: colour, alpha: 1 });
    }
}

function distance(a: Vec2, b: Vec2): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}
