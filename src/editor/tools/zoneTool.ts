/**
 * Zone Draw tool. Two modes driven by ToolSettings.zone.mode:
 *   rect:    click-drag axis-aligned rectangle (Shift = square). Default.
 *   polygon: click vertices, close by clicking near the first vertex or Enter.
 *            Enforces convex CW; refuses to commit concave polygons.
 *
 * Live convexity feedback (45-degree red hatch + red offender vertex) applies
 * in polygon mode. Zone type is read from ToolSettings.zone.zoneType; preview
 * fill colour comes from ZONE_COLORS.
 *
 * Commits create a map-level Zone (not layer-scoped) via SnapshotCommand.
 * Right-click or Escape cancels mid-draw; Escape with no gesture returns to
 * Select. Enter also closes a polygon.
 *
 * Part of the editor layer.
 */

import { Graphics, type Container } from 'pixi.js';

import { ZONE_COLORS } from '@shared/render/zoneColors';
import type { Vec2 } from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import { buildCreateZoneCommand } from '../commands/createZoneCommand';
import {
    closeWithinRadius,
    enforceCW,
    isConvexCW,
    rectangleVertices,
    squareFromDrag,
} from '../geometry/polygon';
import type { SelectionStore } from '../selection/selectionStore';
import type { SnapService } from '../snap/SnapService';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { ToolManager } from './toolManager';
import { CURSORS } from './cursors';
import type { Tool, ToolKeyEvent, ToolPointerEvent } from './tool';
import type { ToolSettingsStore } from './toolSettings';

export interface ZoneToolDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
    snap: SnapService;
    overlayParent: Container;
    settings: ToolSettingsStore;
    toolManager: ToolManager;
}

type RectState = { kind: 'rect'; pointerId: number; anchor: Vec2; current: Vec2; shift: boolean };
type PolyState = { kind: 'polygon'; vertices: Vec2[]; cursor: Vec2 };
type ZoneGesture = RectState | PolyState | null;

const POLY_CLOSE_RADIUS_WORLD = 10;

export class ZoneTool implements Tool {
    readonly id = 'zone';
    readonly cursor = CURSORS.crosshair;

    private gesture: ZoneGesture = null;
    private overlay = new Graphics();

    constructor(private readonly deps: ZoneToolDeps) {
        this.overlay.label = 'editor.zoneTool';
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
        const mode = this.deps.settings.get().zone.mode;

        if (mode === 'rect') {
            this.gesture = { kind: 'rect', pointerId: e.native.pointerId, anchor: pt, current: pt, shift: e.native.shiftKey };
            this.redraw();
            return;
        }

        if (!this.gesture || this.gesture.kind !== 'polygon') {
            this.gesture = { kind: 'polygon', vertices: [pt], cursor: pt };
            this.redraw();
            return;
        }

        const poly = this.gesture;
        if (poly.vertices.length >= 3 && closeWithinRadius(pt, poly.vertices[0], POLY_CLOSE_RADIUS_WORLD)) {
            this.tryCommitPolygon(poly.vertices);
            return;
        }
        poly.vertices.push(pt);
        poly.cursor = pt;
        this.redraw();
    }

    onPointerMove(e: ToolPointerEvent): void {
        if (!this.gesture) return;
        const pt = this.snapPoint(e.worldX, e.worldY);
        if (this.gesture.kind === 'rect') {
            this.gesture.current = pt;
            this.gesture.shift = e.native.shiftKey;
        } else {
            this.gesture.cursor = pt;
        }
        this.redraw();
    }

    onPointerUp(e: ToolPointerEvent): void {
        if (!this.gesture || this.gesture.kind !== 'rect') return;
        if (this.gesture.pointerId !== e.native.pointerId) return;
        const pt = this.snapPoint(e.worldX, e.worldY);
        this.gesture.current = pt;
        this.gesture.shift = e.native.shiftKey;
        this.commitRect(this.gesture);
    }

    onKeyDown(e: ToolKeyEvent): void {
        const key = e.native.key;
        if (key === 'Escape') {
            if (this.gesture) {
                this.cancel();
                return;
            }
            this.deps.toolManager.activate('select');
            return;
        }
        if (key === 'Enter' && this.gesture?.kind === 'polygon') {
            this.tryCommitPolygon(this.gesture.vertices);
        }
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

    private activeZoneColorHex(): number {
        return ZONE_COLORS[this.deps.settings.get().zone.zoneType].hex;
    }

    private commitRect(g: RectState): void {
        const other = g.shift ? squareFromDrag(g.anchor, g.current) : g.current;
        const vertices = rectangleVertices(g.anchor, other);
        if (rectEmpty(vertices)) {
            this.cancel();
            return;
        }
        this.tryCommitVertices(vertices);
    }

    private tryCommitPolygon(vertices: Vec2[]): void {
        if (vertices.length < 3) return;
        const cw = enforceCW(vertices);
        const conv = isConvexCW(cw);
        if (!conv.convex) return;
        this.tryCommitVertices(cw);
    }

    private tryCommitVertices(vertices: Vec2[]): void {
        const { state, stack, selection, settings } = this.deps;
        const result = buildCreateZoneCommand(state, vertices, settings.get().zone.zoneType);
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
        const colour = this.activeZoneColorHex();

        if (this.gesture.kind === 'rect') {
            const { anchor, current, shift } = this.gesture;
            const other = shift ? squareFromDrag(anchor, current) : current;
            const vertices = rectangleVertices(anchor, other);
            drawFill(g, vertices, colour, 0.4);
            drawOutline(g, vertices, colour, 0.8);
            drawVertices(g, [anchor, other], colour);
            return;
        }

        const { vertices, cursor } = this.gesture;
        const preview = [...vertices];
        if (cursor) preview.push(cursor);
        const conv = isConvexCW(preview);

        if (!conv.convex) {
            drawHatchedFill(g, preview);
        } else if (preview.length >= 3) {
            drawFill(g, preview, colour, 0.4);
        }

        for (let i = 0; i + 1 < vertices.length; i++) {
            g.moveTo(vertices[i].x, vertices[i].y).lineTo(vertices[i + 1].x, vertices[i + 1].y);
        }
        g.stroke({ color: colour, width: 1, alpha: 0.8 });

        if (cursor && vertices.length > 0) {
            g.moveTo(vertices[vertices.length - 1].x, vertices[vertices.length - 1].y)
                .lineTo(cursor.x, cursor.y)
                .stroke({ color: colour, width: 1, alpha: 0.8 });
        }

        if (cursor && vertices.length >= 2) {
            drawDashedLine(g, cursor, vertices[0], colour, 0.4);
        }

        drawVertices(g, vertices, colour);
        if (conv.offendingIndex !== null && conv.offendingIndex < vertices.length) {
            const v = vertices[conv.offendingIndex];
            g.rect(v.x - 3, v.y - 3, 6, 6).fill({ color: 0xff3030, alpha: 1 });
        }
    }
}

function drawFill(g: Graphics, vertices: Vec2[], colour: number, alpha: number): void {
    if (vertices.length < 3) return;
    g.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        g.lineTo(vertices[i].x, vertices[i].y);
    }
    g.closePath();
    g.fill({ color: colour, alpha });
}

function drawOutline(g: Graphics, vertices: Vec2[], colour: number, alpha: number): void {
    if (vertices.length < 2) return;
    g.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        g.lineTo(vertices[i].x, vertices[i].y);
    }
    g.lineTo(vertices[0].x, vertices[0].y);
    g.stroke({ color: colour, width: 1, alpha });
}

function drawVertices(g: Graphics, vertices: Vec2[], colour: number): void {
    for (const v of vertices) {
        g.rect(v.x - 3, v.y - 3, 6, 6).fill({ color: colour, alpha: 1 });
    }
}

function drawDashedLine(g: Graphics, a: Vec2, b: Vec2, colour: number, alpha: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len;
    const uy = dy / len;
    const DASH = 4;
    const GAP = 4;
    let t = 0;
    while (t < len) {
        const t1 = Math.min(t + DASH, len);
        g.moveTo(a.x + ux * t, a.y + uy * t).lineTo(a.x + ux * t1, a.y + uy * t1);
        t = t1 + GAP;
    }
    g.stroke({ color: colour, width: 1, alpha });
}

function drawHatchedFill(g: Graphics, vertices: Vec2[]): void {
    if (vertices.length < 3) return;
    drawFill(g, vertices, 0xff3030, 0.3);
    let minX = vertices[0].x;
    let maxX = vertices[0].x;
    let minY = vertices[0].y;
    let maxY = vertices[0].y;
    for (const v of vertices) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }
    const step = 8;
    const start = Math.floor(minX - (maxY - minY));
    const end = Math.ceil(maxX);
    for (let x = start; x <= end; x += step) {
        g.moveTo(x, minY).lineTo(x + (maxY - minY), maxY);
    }
    g.stroke({ color: 0xff3030, width: 1, alpha: 0.6 });
}

function rectEmpty(vertices: Vec2[]): boolean {
    if (vertices.length < 4) return true;
    const a = vertices[0];
    const c = vertices[2];
    return Math.abs(a.x - c.x) < 1 && Math.abs(a.y - c.y) < 1;
}
