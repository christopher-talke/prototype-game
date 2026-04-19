/**
 * Renders the active selection bounds + transform handles + hover outline
 * into the overlayLayer. Subscribes to SelectionStore + EditorCamera and
 * redraws whenever either changes.
 *
 * Part of the editor layer.
 */

import { Container, Graphics, Text } from 'pixi.js';

import type { EditorCamera } from '../viewport/EditorCamera';
import type { SelectionStore } from '../selection/selectionStore';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { CommandStack } from '../commands/CommandStack';
import { boundsOfGUID, unionBounds } from '../selection/boundsOf';
import { findGroupForExactSelection } from '../groups/groupQueries';
import { LAYER_COLORS } from '@shared/render/layerColors';
import { drawSelectionBBox } from './bboxRenderer';
import { drawTransformHandles } from './transformHandles';

const GROUP_LABEL_COLOR_FALLBACK = 0x00e5ff;
const GROUP_LABEL_ALPHA = 0.8;
const GROUP_LABEL_FONT_PX = 11;
const GROUP_LABEL_PAD = 4;

export class SelectionOverlay {
    private bboxGraphics = new Graphics();
    private handlesGraphics = new Graphics();
    private hoverGraphics = new Graphics();
    private labelContainer = new Container();
    private labelText: Text;
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
        this.labelText = new Text({
            text: '',
            style: {
                fill: GROUP_LABEL_COLOR_FALLBACK,
                fontFamily: 'sans-serif',
                fontSize: GROUP_LABEL_FONT_PX,
                fontWeight: '500',
                stroke: { color: 0x000000, width: 3 },
            },
        });
        this.labelText.resolution = 2;
        this.labelContainer.addChild(this.labelText);
        this.labelContainer.visible = false;
        this.container.addChild(
            this.hoverGraphics,
            this.bboxGraphics,
            this.handlesGraphics,
            this.labelContainer,
        );
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
        this.labelContainer.visible = false;
        const guids = this.selection.selectedArray();
        if (guids.length === 0) return;

        const aabb = unionBounds(this.state, guids);
        if (aabb.width === 0 && aabb.height === 0) return;

        const locked = this.allOnLockedLayer(guids);
        if (locked) {
            drawSelectionBBox(this.bboxGraphics, aabb, { kind: 'locked' }, false);
            return;
        }

        const group = findGroupForExactSelection(this.state, guids);

        if (guids.length > 1) {
            for (const guid of guids) {
                const itemAabb = boundsOfGUID(this.state, guid);
                if (itemAabb.width === 0 && itemAabb.height === 0) continue;
                drawSelectionBBox(this.bboxGraphics, itemAabb, { kind: 'member' }, false);
            }
        }

        const kind = group ? 'multi' : (guids.length === 1 ? 'single' : 'multi');
        drawSelectionBBox(this.bboxGraphics, aabb, { kind }, false);
        drawTransformHandles(this.handlesGraphics, aabb, this.camera.zoom);

        if (group) {
            const color = this.groupLabelColor();
            this.labelText.text = group.name;
            this.labelText.style.fill = color;
            const zoom = this.camera.zoom > 0 ? this.camera.zoom : 1;
            const inv = 1 / zoom;
            this.labelContainer.scale.set(inv, inv);
            this.labelContainer.alpha = GROUP_LABEL_ALPHA;
            this.labelContainer.x = aabb.x;
            this.labelContainer.y = aabb.y - (this.labelText.height + GROUP_LABEL_PAD) * inv;
            this.labelContainer.visible = true;
        }
    }

    private groupLabelColor(): number {
        const layer = this.state.map.layers.find((l) => l.id === this.state.activeLayerId);
        if (!layer) return GROUP_LABEL_COLOR_FALLBACK;
        return LAYER_COLORS[layer.type]?.hex ?? GROUP_LABEL_COLOR_FALLBACK;
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
