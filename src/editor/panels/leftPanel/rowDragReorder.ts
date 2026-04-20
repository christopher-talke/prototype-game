/**
 * Shared drag-and-drop wiring for unified-tree rows.
 *
 * Source rows are marked draggable; target rows react to dragover by drawing
 * a before/after insertion line (or a full-border "drop-into" for group
 * reparent drops) and dispatch the resolved drop back to the caller, which
 * routes it through the command stack.
 *
 * Drag payload format: a JSON-encoded `DragMeta` via the
 * `application/x-sightline-drag` MIME type. Using a custom type keeps the
 * browser from mixing drops with arbitrary text payloads.
 *
 * Part of the editor layer.
 */

export type ReorderNode = 'layer' | 'item' | 'group';

export interface DragMeta {
    guid: string;
    container: string;
    node: ReorderNode;
}

const DRAG_MIME = 'application/x-sightline-drag';

export type DropPosition = 'before' | 'after';

/**
 * Active drag meta stored at dragstart so dragover handlers can read it
 * without calling dataTransfer.getData(), which browsers only expose in the
 * drop event (not during dragover).
 */
let activeDrag: DragMeta | null = null;

/** True when dropping `source` onto `target` row is legal. */
export function canDrop(source: DragMeta, target: DragMeta): boolean {
    if (source.guid === target.guid) return false;
    if (source.node === 'layer' || target.node === 'layer') {
        return source.node === target.node && source.container === target.container;
    }
    if (source.container === target.container) return true;
    return target.container.startsWith('group:');
}

export interface WireDragReorderHandlers {
    onDrop(src: DragMeta, position: DropPosition): void;
}

/** Attach drag source + drop target wiring to a single row. */
export function wireDragReorder(
    row: HTMLElement,
    meta: DragMeta,
    handlers: WireDragReorderHandlers,
): void {
    row.draggable = true;
    row.dataset.reorderContainer = meta.container;
    row.dataset.reorderNode = meta.node;

    row.addEventListener('dragstart', (e) => {
        if (!e.dataTransfer) return;
        activeDrag = meta;
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(meta));
        e.dataTransfer.setData('text/plain', meta.guid);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('editor-item-dragging');
    });

    row.addEventListener('dragend', () => {
        activeDrag = null;
        row.classList.remove('editor-item-dragging');
        clearDropMarkers(row);
    });

    row.addEventListener('dragover', (e) => {
        const src = activeDrag;
        if (!src || !canDrop(src, meta)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const position = resolvePosition(e, row);
        clearDropMarkers(row);
        row.classList.add(position === 'before' ? 'editor-drop-before' : 'editor-drop-after');
    });

    row.addEventListener('dragleave', () => {
        clearDropMarkers(row);
    });

    row.addEventListener('drop', (e) => {
        const src = activeDrag ?? readDragMeta(e);
        clearDropMarkers(row);
        if (!src || !canDrop(src, meta)) return;
        e.preventDefault();
        handlers.onDrop(src, resolvePosition(e, row));
    });
}

export interface WireGroupEndDropHandlers {
    onDropOntoEmpty(src: DragMeta): void;
}

/**
 * Wire a lightweight drop-into target for an empty group. Accepts any source
 * whose container string does not match this group's own container (so users
 * cannot drop a group into itself via the empty slot).
 */
export function wireGroupEndDrop(
    row: HTMLElement,
    groupId: string,
    handlers: WireGroupEndDropHandlers,
): void {
    const container = `group:${groupId}`;
    row.addEventListener('dragover', (e) => {
        const src = activeDrag;
        if (!src) return;
        if (src.guid === groupId) return;
        if (src.container === container) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        row.classList.add('editor-drop-into');
    });
    row.addEventListener('dragleave', () => row.classList.remove('editor-drop-into'));
    row.addEventListener('drop', (e) => {
        row.classList.remove('editor-drop-into');
        const src = activeDrag ?? readDragMeta(e);
        if (!src) return;
        if (src.guid === groupId) return;
        if (src.container === container) return;
        e.preventDefault();
        handlers.onDropOntoEmpty(src);
    });
}

function readDragMeta(e: DragEvent): DragMeta | null {
    if (!e.dataTransfer) return null;
    try {
        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (!raw) return null;
        return JSON.parse(raw) as DragMeta;
    } catch {
        return null;
    }
}

function resolvePosition(e: DragEvent, row: HTMLElement): DropPosition {
    const rect = row.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    return e.clientY < midpoint ? 'before' : 'after';
}

function clearDropMarkers(row: HTMLElement): void {
    row.classList.remove('editor-drop-before');
    row.classList.remove('editor-drop-after');
    row.classList.remove('editor-drop-into');
}
