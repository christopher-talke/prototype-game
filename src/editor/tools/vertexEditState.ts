/**
 * Ephemeral store for the Vertex Edit sub-tool.
 *
 * Holds the currently-edited polygon's GUID, the selected / hovered vertex,
 * the hovered edge, and any in-flight drag. Subscribers (the overlay, the
 * selection overlay) re-render on change. Never persisted, never in the
 * undo stack.
 *
 * Part of the editor layer.
 */

export interface VertexEditHoverEdge {
    index: number;
    t: number;
    x: number;
    y: number;
}

export interface VertexEditDrag {
    vertexIndex: number;
    beforeJson: string;
}

export type VertexEditListener = () => void;

export class VertexEditState {
    private targetGuid: string | null = null;
    private selectedIndex: number | null = null;
    private hoverIndex: number | null = null;
    private hoverEdge: VertexEditHoverEdge | null = null;
    private dragging: VertexEditDrag | null = null;
    private concavePreview = false;
    private listeners = new Set<VertexEditListener>();

    getTargetGuid(): string | null {
        return this.targetGuid;
    }

    getSelectedIndex(): number | null {
        return this.selectedIndex;
    }

    getHoverIndex(): number | null {
        return this.hoverIndex;
    }

    getHoverEdge(): VertexEditHoverEdge | null {
        return this.hoverEdge;
    }

    getDragging(): VertexEditDrag | null {
        return this.dragging;
    }

    isConcavePreview(): boolean {
        return this.concavePreview;
    }

    setTarget(guid: string | null): void {
        if (this.targetGuid === guid) return;
        this.targetGuid = guid;
        this.selectedIndex = null;
        this.hoverIndex = null;
        this.hoverEdge = null;
        this.dragging = null;
        this.concavePreview = false;
        this.notify();
    }

    setSelectedIndex(index: number | null): void {
        if (this.selectedIndex === index) return;
        this.selectedIndex = index;
        this.notify();
    }

    setHover(
        hoverIndex: number | null,
        hoverEdge: VertexEditHoverEdge | null,
    ): void {
        const vertexEq = this.hoverIndex === hoverIndex;
        const edgeEq = this.hoverEdge === hoverEdge
            || (hoverEdge !== null
                && this.hoverEdge !== null
                && this.hoverEdge.index === hoverEdge.index
                && this.hoverEdge.x === hoverEdge.x
                && this.hoverEdge.y === hoverEdge.y);
        if (vertexEq && edgeEq) return;
        this.hoverIndex = hoverIndex;
        this.hoverEdge = hoverEdge;
        this.notify();
    }

    setDragging(drag: VertexEditDrag | null): void {
        if (this.dragging === drag) return;
        this.dragging = drag;
        this.notify();
    }

    setConcavePreview(value: boolean): void {
        if (this.concavePreview === value) return;
        this.concavePreview = value;
        this.notify();
    }

    subscribe(listener: VertexEditListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const l of this.listeners) l();
    }
}
