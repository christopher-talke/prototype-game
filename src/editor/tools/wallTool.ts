/**
 * Wall Draw tool. Four modes driven by ToolSettings.wall.mode:
 *   rect:        click-drag axis-aligned rectangle (Shift = square)
 *   line:        two clicks -> thin rectangle of configured thickness
 *   polygon:     click vertices, close by clicking near the first vertex or
 *                Enter. Enforces convex CW; refuses to commit concave polygons.
 *   rotatedRect: three clicks -> first corner, second corner along an
 *                arbitrary "width" axis, then a third point whose signed
 *                perpendicular distance from the axis sets height.
 *
 * All preview rendering goes into a Graphics on overlayParent. All commits
 * dispatch through SnapshotCommand via buildCreateWallCommand.
 *
 * Part of the editor layer.
 */

import { Graphics, type Container } from 'pixi.js';

import { LAYER_COLORS } from '@shared/render/layerColors';
import type { Vec2 } from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import { buildCreateWallCommand } from '../commands/createWallCommand';
import {
    closeWithinRadius,
    enforceCW,
    isConvexCW,
    lineWallVertices,
    rectangleVertices,
    rotatedRectangleVertices,
    signedPerpendicularDistance,
    squareFromDrag,
} from '../geometry/polygon';
import type { SelectionStore } from '../selection/selectionStore';
import type { SnapService } from '../snap/SnapService';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { ToolManager } from './toolManager';
import type { EditorCamera } from '../viewport/EditorCamera';
import { CURSORS } from './cursors';
import type { Tool, ToolKeyEvent, ToolPointerEvent } from './tool';
import type { ToolSettingsStore } from './toolSettings';

export interface WallToolDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
    snap: SnapService;
    camera: EditorCamera;
    overlayParent: Container;
    settings: ToolSettingsStore;
    toolManager: ToolManager;
}

type RectState = { kind: 'rect'; pointerId: number; anchor: Vec2; current: Vec2; shift: boolean };
type LineState = { kind: 'line'; first: Vec2 };
type PolyState = { kind: 'polygon'; vertices: Vec2[]; cursor: Vec2 };
type RotRectState =
    | { kind: 'rotatedRect'; phase: 'awaiting-second'; a: Vec2; cursor: Vec2 }
    | { kind: 'rotatedRect'; phase: 'awaiting-third'; a: Vec2; b: Vec2; cursor: Vec2 };

type WallGesture = RectState | LineState | PolyState | RotRectState | null;

const POLY_CLOSE_RADIUS_WORLD = 10;
const ROT_RECT_MIN_HEIGHT_WORLD = 1;

export class WallTool implements Tool {
    readonly id = 'wall';
    readonly cursor = CURSORS.crosshair;

    private gesture: WallGesture = null;
    private overlay = new Graphics();

    constructor(private readonly deps: WallToolDeps) {
        this.overlay.label = 'editor.wallTool';
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
        const mode = this.deps.settings.get().wall.mode;
        const pt = this.snapPoint(e.worldX, e.worldY);

        if (mode === 'rect') {
            this.gesture = {
                kind: 'rect',
                pointerId: e.native.pointerId,
                anchor: pt,
                current: pt,
                shift: e.native.shiftKey,
            };
            this.redraw();
            return;
        }

        if (mode === 'line') {
            if (!this.gesture || this.gesture.kind !== 'line') {
                this.gesture = { kind: 'line', first: pt };
                this.redraw();
                return;
            }
            // second click -> commit
            const { first } = this.gesture;
            this.commitLine(first, pt);
            return;
        }

        if (mode === 'polygon') {
            if (!this.gesture || this.gesture.kind !== 'polygon') {
                this.gesture = { kind: 'polygon', vertices: [pt], cursor: pt };
                this.redraw();
                return;
            }
            const poly = this.gesture;
            // Close if near first vertex and we have at least 3 vertices
            if (poly.vertices.length >= 3 && closeWithinRadius(pt, poly.vertices[0], POLY_CLOSE_RADIUS_WORLD)) {
                this.tryCommitPolygon(poly.vertices);
                return;
            }
            poly.vertices.push(pt);
            poly.cursor = pt;
            this.redraw();
            return;
        }

        if (mode === 'rotatedRect') {
            if (!this.gesture || this.gesture.kind !== 'rotatedRect') {
                this.gesture = { kind: 'rotatedRect', phase: 'awaiting-second', a: pt, cursor: pt };
                this.redraw();
                return;
            }
            if (this.gesture.phase === 'awaiting-second') {
                if (pt.x === this.gesture.a.x && pt.y === this.gesture.a.y) return;
                this.gesture = {
                    kind: 'rotatedRect',
                    phase: 'awaiting-third',
                    a: this.gesture.a,
                    b: pt,
                    cursor: pt,
                };
                this.redraw();
                return;
            }
            // awaiting-third -> commit
            const { a, b } = this.gesture;
            const h = signedPerpendicularDistance(pt, a, b);
            if (Math.abs(h) < ROT_RECT_MIN_HEIGHT_WORLD) return;
            this.dispatchCreate(rotatedRectangleVertices(a, b, h));
        }
    }

    onPointerMove(e: ToolPointerEvent): void {
        if (!this.gesture) return;
        const pt = this.snapPoint(e.worldX, e.worldY);
        if (this.gesture.kind === 'rect') {
            this.gesture.current = pt;
            this.gesture.shift = e.native.shiftKey;
        } else if (this.gesture.kind === 'line') {
            // second-point preview is tracked via cursor; store on the state
            (this.gesture as LineState & { cursor?: Vec2 }).cursor = pt;
        } else if (this.gesture.kind === 'polygon') {
            this.gesture.cursor = pt;
        } else if (this.gesture.kind === 'rotatedRect') {
            this.gesture.cursor = pt;
        }
        this.redraw();
    }

    onPointerUp(e: ToolPointerEvent): void {
        if (!this.gesture) return;
        if (this.gesture.kind === 'rect' && this.gesture.pointerId === e.native.pointerId) {
            const pt = this.snapPoint(e.worldX, e.worldY);
            this.gesture.current = pt;
            this.gesture.shift = e.native.shiftKey;
            this.commitRect(this.gesture);
        }
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

    private activeLayerColorHex(): number {
        const { state } = this.deps;
        const layer = state.map.layers.find((l) => l.id === state.activeLayerId);
        if (!layer) return 0x00e5ff;
        return LAYER_COLORS[layer.type].hex;
    }

    private commitRect(g: RectState): void {
        const corner = g.shift ? squareFromDrag(g.anchor, g.current) : g.current;
        const vertices = rectangleVertices(g.anchor, corner);
        if (rectEmpty(vertices)) {
            this.cancel();
            return;
        }
        this.dispatchCreate(vertices);
    }

    private commitLine(a: Vec2, b: Vec2): void {
        if (a.x === b.x && a.y === b.y) {
            this.cancel();
            return;
        }
        const thickness = Math.max(1, this.deps.settings.get().wall.thickness);
        const vertices = lineWallVertices(a, b, thickness);
        this.dispatchCreate(vertices);
    }

    private tryCommitPolygon(vertices: Vec2[]): void {
        if (vertices.length < 3) return;
        const cw = enforceCW(vertices);
        const conv = isConvexCW(cw);
        if (!conv.convex) return;
        this.dispatchCreate(cw);
    }

    private dispatchCreate(vertices: Vec2[]): void {
        const { state, stack, selection, settings } = this.deps;
        const layerId = state.activeLayerId;
        if (!layerId) {
            this.cancel();
            return;
        }
        const result = buildCreateWallCommand(state, layerId, vertices, {
            wallType: settings.get().wall.wallType,
        });
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
        const colour = this.activeLayerColorHex();

        if (this.gesture.kind === 'rect') {
            const { anchor, current, shift } = this.gesture;
            const other = shift ? squareFromDrag(anchor, current) : current;
            const vertices = rectangleVertices(anchor, other);
            drawPreviewPolygon(g, vertices, colour);
            drawVertices(g, vertices, colour);
            return;
        }

        if (this.gesture.kind === 'line') {
            const thickness = Math.max(1, this.deps.settings.get().wall.thickness);
            const cursor = (this.gesture as LineState & { cursor?: Vec2 }).cursor;
            const a = this.gesture.first;
            drawVertices(g, [a], colour);
            if (cursor) {
                const vertices = lineWallVertices(a, cursor, thickness);
                drawPreviewPolygon(g, vertices, colour);
            }
            return;
        }

        if (this.gesture.kind === 'polygon') {
            const { vertices, cursor } = this.gesture;
            const preview = [...vertices];
            if (cursor) preview.push(cursor);
            const conv = isConvexCW(preview);

            if (!conv.convex) {
                drawHatchedFill(g, preview);
            } else if (preview.length >= 3) {
                drawFill(g, preview, colour, 0.4);
            }

            // edges between placed vertices (solid)
            for (let i = 0; i + 1 < vertices.length; i++) {
                g.moveTo(vertices[i].x, vertices[i].y).lineTo(vertices[i + 1].x, vertices[i + 1].y);
            }
            g.stroke({ color: colour, width: 1, alpha: 0.8 });

            // rubber-band edge from last vertex to cursor (solid)
            if (cursor && vertices.length > 0) {
                g.moveTo(vertices[vertices.length - 1].x, vertices[vertices.length - 1].y)
                    .lineTo(cursor.x, cursor.y)
                    .stroke({ color: colour, width: 1, alpha: 0.8 });
            }

            // closing edge (dashed) from cursor back to first vertex if >= 2 placed vertices
            if (cursor && vertices.length >= 2) {
                drawDashedLine(g, cursor, vertices[0], colour, 0.4);
            }

            // vertex squares
            drawVertices(g, vertices, colour);
            if (conv.offendingIndex !== null && conv.offendingIndex < vertices.length) {
                const v = vertices[conv.offendingIndex];
                g.rect(v.x - 3, v.y - 3, 6, 6).fill({ color: 0xff3030, alpha: 1 });
            }
            return;
        }

        if (this.gesture.kind === 'rotatedRect') {
            if (this.gesture.phase === 'awaiting-second') {
                const { a, cursor } = this.gesture;
                drawDashedLine(g, a, cursor, colour, 0.8);
                drawVertices(g, [a], colour);
                return;
            }
            // awaiting-third
            const { a, b, cursor } = this.gesture;
            g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: colour, width: 1, alpha: 0.8 });
            const h = signedPerpendicularDistance(cursor, a, b);
            if (Math.abs(h) >= ROT_RECT_MIN_HEIGHT_WORLD) {
                const vertices = rotatedRectangleVertices(a, b, h);
                drawPreviewPolygon(g, vertices, colour);
                drawVertices(g, vertices, colour);
            } else {
                drawVertices(g, [a, b], colour);
            }
        }
    }
}

function drawPreviewPolygon(g: Graphics, vertices: Vec2[], colour: number): void {
    drawFill(g, vertices, colour, 0.4);
    drawOutline(g, vertices, colour, 0.8);
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
    // Base translucent red fill
    drawFill(g, vertices, 0xff3030, 0.3);
    // 45-degree hatch lines within the polygon's bounding box
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
