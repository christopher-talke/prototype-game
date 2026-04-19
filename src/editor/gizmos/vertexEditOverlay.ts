/**
 * Overlay for the Vertex Edit sub-tool.
 *
 * Draws a square handle at each vertex of the target polygon, a "+" marker
 * on the hovered edge for insert-on-click feedback, and a red hatched fill
 * over the polygon when an in-progress drag has pushed it non-convex.
 *
 * Handles are sized in screen pixels via `inv = 1 / zoom` so they stay
 * visually constant across zoom levels.
 *
 * Part of the editor layer.
 */

import { Container, Graphics } from 'pixi.js';

import type { Vec2, Wall, Zone } from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { EditorCamera } from '../viewport/EditorCamera';
import type { VertexEditState } from '../tools/vertexEditState';

const HANDLE_PX = 8;
const EDGE_MARK_PX = 6;
const HANDLE_COLOR = 0x00e5ff;
const CONCAVE_COLOR = 0xff3030;

export class VertexEditOverlay {
    private handles = new Graphics();
    private fill = new Graphics();
    private edgeMarker = new Graphics();
    private container = new Container();
    private unsubs: Array<() => void> = [];

    constructor(
        private readonly state: EditorWorkingState,
        private readonly camera: EditorCamera,
        private readonly stack: CommandStack,
        private readonly store: VertexEditState,
        parent: Container,
    ) {
        this.container.label = 'editor.vertexEditOverlay';
        this.container.addChild(this.fill, this.edgeMarker, this.handles);
        parent.addChild(this.container);

        this.unsubs.push(this.store.subscribe(() => this.redraw()));
        this.unsubs.push(this.camera.subscribe(() => this.redraw()));
        this.unsubs.push(this.stack.subscribe(() => this.redraw()));
        this.redraw();
    }

    destroy(): void {
        for (const u of this.unsubs) u();
        this.unsubs = [];
        this.container.destroy({ children: true });
    }

    redraw(): void {
        this.handles.clear();
        this.fill.clear();
        this.edgeMarker.clear();

        const target = this.store.getTargetGuid();
        if (!target) return;

        const verts = this.getVertices(target);
        if (!verts || verts.length < 3) return;

        const zoom = this.camera.zoom > 0 ? this.camera.zoom : 1;
        const inv = 1 / zoom;

        if (this.store.isConcavePreview()) {
            drawHatchedFill(this.fill, verts);
        }

        const selected = this.store.getSelectedIndex();
        const hovered = this.store.getHoverIndex();

        const half = (HANDLE_PX * inv) / 2;
        for (let i = 0; i < verts.length; i++) {
            const v = verts[i];
            if (selected === i) {
                this.handles
                    .rect(v.x - half, v.y - half, half * 2, half * 2)
                    .fill({ color: HANDLE_COLOR, alpha: 1 })
                    .rect(
                        v.x - half - 2 * inv,
                        v.y - half - 2 * inv,
                        half * 2 + 4 * inv,
                        half * 2 + 4 * inv,
                    )
                    .stroke({ color: HANDLE_COLOR, width: 2 * inv, alpha: 1 });
            } else if (hovered === i) {
                this.handles
                    .rect(v.x - half, v.y - half, half * 2, half * 2)
                    .fill({ color: HANDLE_COLOR, alpha: 0.5 })
                    .stroke({ color: HANDLE_COLOR, width: 1 * inv, alpha: 1 });
            } else {
                this.handles
                    .rect(v.x - half, v.y - half, half * 2, half * 2)
                    .stroke({ color: HANDLE_COLOR, width: 1 * inv, alpha: 1 });
            }
        }

        const edge = this.store.getHoverEdge();
        if (edge && !this.store.getDragging()) {
            const r = EDGE_MARK_PX * inv;
            this.edgeMarker
                .moveTo(edge.x - r, edge.y)
                .lineTo(edge.x + r, edge.y)
                .moveTo(edge.x, edge.y - r)
                .lineTo(edge.x, edge.y + r)
                .stroke({ color: HANDLE_COLOR, width: 1.5 * inv, alpha: 1 });
        }
    }

    private getVertices(guid: string): Vec2[] | null {
        const ref = this.state.byGUID.get(guid);
        if (!ref) return null;
        if (ref.kind === 'wall') {
            for (const layer of this.state.map.layers) {
                const w = layer.walls.find((x) => x.id === guid) as Wall | undefined;
                if (w) return w.vertices;
            }
            return null;
        }
        if (ref.kind === 'zone') {
            const z = this.state.map.zones.find((x) => x.id === guid) as Zone | undefined;
            return z ? z.polygon : null;
        }
        return null;
    }
}

function drawHatchedFill(g: Graphics, vertices: Vec2[]): void {
    if (vertices.length < 3) return;
    g.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        g.lineTo(vertices[i].x, vertices[i].y);
    }
    g.closePath();
    g.fill({ color: CONCAVE_COLOR, alpha: 0.3 });

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
    g.stroke({ color: CONCAVE_COLOR, width: 1, alpha: 0.6 });
}
