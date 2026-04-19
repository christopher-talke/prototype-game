/**
 * Vertex Edit sub-tool (V).
 *
 * Operates on a single Wall or Zone. Drag existing vertices, click an edge
 * to insert a new vertex, Delete/Backspace to remove the selected vertex.
 * Convexity + CW winding are enforced at commit: a drag that would produce
 * a concave polygon is reverted on release; inserts/deletes that would
 * produce < 3 vertices or a concave shape are rejected outright.
 *
 * The tool mutates the live polygon directly during a drag (for visual
 * feedback via the existing renderer rebuild path) and snapshots the
 * pre-drag MapData into `beforeJson`. On successful release it restores
 * from `beforeJson` and dispatches a SnapshotCommand so undo works.
 *
 * Part of the editor layer.
 */

import type { Container } from 'pixi.js';

import type { Vec2, Wall, Zone } from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import { buildUpdatePolygonVerticesCommand } from '../commands/updatePolygonVerticesCommand';
import { enforceCW, isConvexCW } from '../geometry/polygon';
import { pickEdge, pickVertex } from '../geometry/polygonHitTest';
import type { SelectionStore } from '../selection/selectionStore';
import type { SnapService } from '../snap/SnapService';
import { replaceFromSnapshot, type EditorWorkingState } from '../state/EditorWorkingState';
import type { EditorMapRenderer } from '../rendering/editorMapRenderer';
import type { EditorCamera } from '../viewport/EditorCamera';
import { CURSORS } from './cursors';
import type { Tool, ToolKeyEvent, ToolPointerEvent } from './tool';
import type { ToolManager } from './toolManager';
import type { VertexEditState } from './vertexEditState';

/** Radius in screen pixels for vertex / edge pick. */
const PICK_RADIUS_SCREEN = 8;

export interface VertexEditArgs {
    targetGuid?: string;
}

export interface VertexEditToolDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
    snap: SnapService;
    camera: EditorCamera;
    renderer: EditorMapRenderer;
    overlayParent: Container;
    toolManager: ToolManager;
    store: VertexEditState;
}

export class VertexEditTool implements Tool {
    readonly id = 'vertexEdit';
    readonly cursor = CURSORS.crosshair;

    constructor(private readonly deps: VertexEditToolDeps) {}

    activate(args?: unknown): void {
        const a = (args ?? {}) as VertexEditArgs;
        const requested = a.targetGuid ?? this.resolveFromSelection();
        if (!requested || !this.isEditablePolygon(requested)) {
            this.deps.toolManager.activate('select');
            return;
        }
        this.deps.selection.select(requested);
        this.deps.store.setTarget(requested);
    }

    deactivate(): void {
        const drag = this.deps.store.getDragging();
        if (drag) {
            replaceFromSnapshot(this.deps.state, drag.beforeJson);
            this.deps.renderer.rebuild();
        }
        this.deps.store.setTarget(null);
    }

    onPointerDown(e: ToolPointerEvent): void {
        if (e.native.button !== 0) return;
        const target = this.deps.store.getTargetGuid();
        if (!target) return;
        const verts = this.getVertices(target);
        if (!verts) return;

        const radiusWorld = PICK_RADIUS_SCREEN / this.deps.camera.zoom;

        const vIdx = pickVertex(verts, e.worldX, e.worldY, radiusWorld);
        if (vIdx !== null) {
            const beforeJson = JSON.stringify(this.deps.state.map);
            this.deps.store.setSelectedIndex(vIdx);
            this.deps.store.setDragging({ vertexIndex: vIdx, beforeJson });
            return;
        }

        const edge = pickEdge(verts, e.worldX, e.worldY, radiusWorld);
        if (edge !== null) {
            const insertAt = edge.index + 1;
            const snapped = this.deps.snap.snapToGrid(edge.x, edge.y);
            const nextVerts = [
                ...verts.slice(0, insertAt),
                { x: snapped.x, y: snapped.y },
                ...verts.slice(insertAt),
            ];
            const cmd = buildUpdatePolygonVerticesCommand(this.deps.state, target, nextVerts);
            if (cmd) {
                this.deps.stack.dispatch(cmd);
                this.deps.store.setSelectedIndex(insertAt);
            }
            return;
        }

        this.deps.toolManager.activate('select');
    }

    onPointerMove(e: ToolPointerEvent): void {
        const target = this.deps.store.getTargetGuid();
        if (!target) return;
        const verts = this.getVertices(target);
        if (!verts) return;

        const drag = this.deps.store.getDragging();
        if (drag) {
            const snapped = this.deps.snap.snapToGrid(e.worldX, e.worldY);
            verts[drag.vertexIndex] = { x: snapped.x, y: snapped.y };
            this.deps.store.setConcavePreview(!isConvexCW(verts).convex);
            this.deps.renderer.rebuild();
            return;
        }

        const radiusWorld = PICK_RADIUS_SCREEN / this.deps.camera.zoom;
        const vIdx = pickVertex(verts, e.worldX, e.worldY, radiusWorld);
        const edge = vIdx === null
            ? pickEdge(verts, e.worldX, e.worldY, radiusWorld)
            : null;
        this.deps.store.setHover(vIdx, edge);
    }

    onPointerUp(e: ToolPointerEvent): void {
        const target = this.deps.store.getTargetGuid();
        const drag = this.deps.store.getDragging();
        if (!target || !drag) return;

        const verts = this.getVertices(target);
        if (!verts) {
            this.deps.store.setDragging(null);
            this.deps.store.setConcavePreview(false);
            return;
        }

        // Final snap for the release point.
        const snapped = this.deps.snap.snapToGrid(e.worldX, e.worldY);
        verts[drag.vertexIndex] = { x: snapped.x, y: snapped.y };

        const beforeJson = drag.beforeJson;
        const convex = isConvexCW(verts).convex;

        if (!convex) {
            replaceFromSnapshot(this.deps.state, beforeJson);
            this.deps.renderer.rebuild();
            this.deps.store.setDragging(null);
            this.deps.store.setConcavePreview(false);
            return;
        }

        const currentVerts = verts.map((v) => ({ x: v.x, y: v.y }));
        replaceFromSnapshot(this.deps.state, beforeJson);
        const cmd = buildUpdatePolygonVerticesCommand(
            this.deps.state,
            target,
            enforceCW(currentVerts),
        );
        if (cmd) {
            this.deps.stack.dispatch(cmd);
        } else {
            this.deps.renderer.rebuild();
        }
        this.deps.store.setDragging(null);
        this.deps.store.setConcavePreview(false);
    }

    onKeyDown(e: ToolKeyEvent): void {
        const key = e.native.key;
        if (key === 'Escape') {
            this.deps.toolManager.activate('select');
            return;
        }
        if (key === 'Delete' || key === 'Backspace') {
            this.deleteSelectedVertex();
            return;
        }
        if (key === 'v' || key === 'V') {
            // already active, swallow
            return;
        }
    }

    private deleteSelectedVertex(): void {
        const target = this.deps.store.getTargetGuid();
        const idx = this.deps.store.getSelectedIndex();
        if (!target || idx === null) return;
        const verts = this.getVertices(target);
        if (!verts) return;
        if (verts.length <= 3) return;

        const next = verts.filter((_, i) => i !== idx);
        const cmd = buildUpdatePolygonVerticesCommand(this.deps.state, target, next);
        if (!cmd) return;
        this.deps.stack.dispatch(cmd);
        this.deps.store.setSelectedIndex(null);
    }

    private resolveFromSelection(): string | null {
        const guids = this.deps.selection.selectedArray();
        if (guids.length !== 1) return null;
        return this.isEditablePolygon(guids[0]) ? guids[0] : null;
    }

    private isEditablePolygon(guid: string): boolean {
        const ref = this.deps.state.byGUID.get(guid);
        if (!ref) return false;
        return ref.kind === 'wall' || ref.kind === 'zone';
    }

    private getVertices(guid: string): Vec2[] | null {
        const ref = this.deps.state.byGUID.get(guid);
        if (!ref) return null;
        if (ref.kind === 'wall') {
            for (const layer of this.deps.state.map.layers) {
                const w = layer.walls.find((x) => x.id === guid) as Wall | undefined;
                if (w) return w.vertices;
            }
            return null;
        }
        if (ref.kind === 'zone') {
            const z = this.deps.state.map.zones.find((x) => x.id === guid) as Zone | undefined;
            return z ? z.polygon : null;
        }
        return null;
    }
}
