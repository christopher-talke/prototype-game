/**
 * Renders the active selection bounds + transform handles + hover outline
 * into the overlayLayer. Subscribes to SelectionStore + EditorCamera and
 * redraws whenever either changes.
 *
 * Part of the editor layer.
 */

import { Container, Graphics } from 'pixi.js';

import type { EditorCamera } from '../viewport/EditorCamera';
import type { SelectionStore } from '../selection/selectionStore';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { CommandStack } from '../commands/CommandStack';
import { boundsOfGUID, unionBounds } from '../selection/boundsOf';
import { drawSelectionBBox } from './bboxRenderer';
import { drawTransformHandles } from './transformHandles';

export class SelectionOverlay {
    private bboxGraphics = new Graphics();
    private handlesGraphics = new Graphics();
    private hoverGraphics = new Graphics();
    private container = new Container();
    private unsubscribeSelection: (() => void) | null = null;
    private unsubscribeCamera: (() => void) | null = null;
    private unsubscribeStack: (() => void) | null = null;

    constructor(
        private readonly state: EditorWorkingState,
        private readonly selection: SelectionStore,
        private readonly camera: EditorCamera,
        private readonly stack: CommandStack,
        parent: Container,
    ) {
        this.container.label = 'editor.selectionOverlay';
        this.container.addChild(this.hoverGraphics, this.bboxGraphics, this.handlesGraphics);
        parent.addChild(this.container);

        this.unsubscribeSelection = this.selection.subscribe(() => this.redraw());
        this.unsubscribeCamera = this.camera.subscribe(() => this.redraw());
        this.unsubscribeStack = this.stack.subscribe(() => {
            this.selection.pruneAgainst(this.state);
            this.redraw();
        });
        this.redraw();
    }

    /** Force a redraw (e.g. after dependent state changes). */
    redraw(): void {
        this.drawHover();
        this.drawSelection();
    }

    destroy(): void {
        this.unsubscribeSelection?.();
        this.unsubscribeCamera?.();
        this.unsubscribeStack?.();
        this.container.destroy({ children: true });
    }

    private drawHover(): void {
        const guid = this.selection.hover();
        this.hoverGraphics.clear();
        if (!guid || this.selection.has(guid)) return;
        const aabb = boundsOfGUID(this.state, guid);
        if (aabb.width === 0 && aabb.height === 0) return;
        drawSelectionBBox(this.hoverGraphics, aabb, { kind: 'hover' });
    }

    private drawSelection(): void {
        this.bboxGraphics.clear();
        this.handlesGraphics.clear();
        const guids = this.selection.selectedArray();
        if (guids.length === 0) return;

        const aabb = unionBounds(this.state, guids);
        if (aabb.width === 0 && aabb.height === 0) return;

        const locked = this.allOnLockedLayer(guids);
        if (locked) {
            drawSelectionBBox(this.bboxGraphics, aabb, { kind: 'locked' }, false);
            return;
        }

        if (guids.length > 1) {
            for (const guid of guids) {
                const itemAabb = boundsOfGUID(this.state, guid);
                if (itemAabb.width === 0 && itemAabb.height === 0) continue;
                drawSelectionBBox(this.bboxGraphics, itemAabb, { kind: 'member' }, false);
            }
        }

        drawSelectionBBox(
            this.bboxGraphics,
            aabb,
            { kind: guids.length === 1 ? 'single' : 'multi' },
            false,
        );
        drawTransformHandles(this.handlesGraphics, aabb, this.camera.zoom);
    }

    private allOnLockedLayer(guids: string[]): boolean {
        for (const guid of guids) {
            const ref = this.state.byGUID.get(guid);
            if (!ref?.layerId) return false;
            const layer = this.state.map.layers.find((l) => l.id === ref.layerId);
            if (!layer || !layer.locked) return false;
        }
        return guids.length > 0;
    }
}
