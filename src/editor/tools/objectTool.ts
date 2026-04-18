/**
 * Object placement tool. Activation with a `{defId}` arg spawns a preview
 * Container (via buildObjectContainer) parented to overlayParent; it tracks
 * the cursor and is tinted to the active layer colour at 0.4 alpha. Left
 * click commits via buildCreateObjectCommand and keeps the tool active for
 * repeated placement. Escape returns to Select; if activated with no def,
 * delegates to onRequestPalette so the caller can open the quick palette.
 *
 * Part of the editor layer.
 */

import { Container, Sprite } from 'pixi.js';

import { LAYER_COLORS } from '@shared/render/layerColors';
import type { Vec2 } from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import { buildCreateObjectCommand } from '../commands/createObjectCommand';
import { buildObjectContainer } from '../rendering/objects';
import type { SpriteCache } from '../rendering/spriteCache';
import type { SelectionStore } from '../selection/selectionStore';
import type { SnapService } from '../snap/SnapService';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { CURSORS } from './cursors';
import type { Tool, ToolKeyEvent, ToolPointerEvent } from './tool';
import type { ToolManager } from './toolManager';

export interface ObjectToolArgs {
    defId: string;
}

export interface ObjectToolDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
    snap: SnapService;
    overlayParent: Container;
    spriteCache: SpriteCache;
    toolManager: ToolManager;
    onRequestPalette: () => void;
}

export class ObjectTool implements Tool {
    readonly id = 'object';
    readonly cursor = CURSORS.crosshair;

    private currentDefId: string | null = null;
    private preview: Container | null = null;
    private cursorWorld: Vec2 = { x: 0, y: 0 };
    private cacheUnsubscribe: (() => void) | null = null;

    constructor(private readonly deps: ObjectToolDeps) {}

    activate(args?: unknown): void {
        const a = args as Partial<ObjectToolArgs> | undefined;
        const defId = a?.defId ?? null;
        this.currentDefId = defId;
        this.clearPreview();
        if (!defId) {
            this.deps.onRequestPalette();
            return;
        }
        this.buildPreview(defId);
    }

    deactivate(): void {
        this.currentDefId = null;
        this.clearPreview();
    }

    defId(): string | null {
        return this.currentDefId;
    }

    onPointerMove(e: ToolPointerEvent): void {
        this.cursorWorld = this.snapPoint(e.worldX, e.worldY);
        if (this.preview) {
            this.preview.x = this.cursorWorld.x;
            this.preview.y = this.cursorWorld.y;
        }
    }

    onPointerDown(e: ToolPointerEvent): void {
        if (e.native.button !== 0) return;
        if (!this.currentDefId) return;
        const { state, stack, selection } = this.deps;
        const layerId = state.activeLayerId;
        if (!layerId) return;
        const pt = this.snapPoint(e.worldX, e.worldY);
        const result = buildCreateObjectCommand(state, layerId, this.currentDefId, pt);
        if (!result) return;
        stack.dispatch(result.command);
        selection.select(result.newGuid);
    }

    onKeyDown(e: ToolKeyEvent): void {
        if (e.native.key === 'Escape') {
            this.deps.toolManager.activate('select');
        }
    }

    private snapPoint(x: number, y: number): Vec2 {
        return this.deps.snap.snapToGrid(x, y);
    }

    private activeLayerColorHex(): number {
        const { state } = this.deps;
        const layer = state.map.layers.find((l) => l.id === state.activeLayerId);
        if (!layer) return 0x00e5ff;
        return LAYER_COLORS[layer.type].hex;
    }

    private buildPreview(defId: string): void {
        const { state, overlayParent, spriteCache } = this.deps;
        const def = state.map.objectDefs.find((d) => d.id === defId);
        if (!def) return;
        const placement = {
            id: 'editor.objectTool.preview',
            objectDefId: defId,
            position: { x: this.cursorWorld.x, y: this.cursorWorld.y },
            rotation: 0,
            scale: { x: 1, y: 1 },
        };
        const c = buildObjectContainer(placement, def, spriteCache);
        c.eventMode = 'none';
        c.interactive = false;
        c.alpha = 0.4;
        tintContainer(c, this.activeLayerColorHex());
        overlayParent.addChild(c);
        this.preview = c;
        this.cacheUnsubscribe = spriteCache.onLoaded(() => this.rebuildPreview());
    }

    private rebuildPreview(): void {
        if (!this.currentDefId) return;
        this.clearPreview();
        this.buildPreview(this.currentDefId);
    }

    private clearPreview(): void {
        if (this.preview) {
            this.preview.parent?.removeChild(this.preview);
            this.preview.destroy({ children: true });
            this.preview = null;
        }
        if (this.cacheUnsubscribe) {
            this.cacheUnsubscribe();
            this.cacheUnsubscribe = null;
        }
    }
}

function tintContainer(c: Container, tint: number): void {
    for (const child of c.children) {
        if (child instanceof Sprite) {
            child.tint = tint;
        } else if (child instanceof Container) {
            tintContainer(child, tint);
        }
    }
}
