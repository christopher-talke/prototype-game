/**
 * Top-level editor map renderer.
 *
 * Subscribes to CommandStack changes (and other state-changing signals) and
 * rebuilds the per-item Containers under each sublayer. Maintains GUID-keyed
 * registries so selection/hit-test can look up Containers in O(1).
 *
 * When a DragOverlay is active, items in the overlay are dimmed to 20%
 * (ghost) and a preview Container is added at the dragged position.
 *
 * Phase 2 implementation: full rebuild on every change. Acceptable for the
 * 10k-items-per-map ceiling; incremental rebuilds are post-ship.
 *
 * Part of the editor layer.
 */

import { Container, Graphics } from 'pixi.js';

import type {
    DecalPlacement,
    EntityPlacement,
    LightPlacement,
    MapLayer,
    ObjectPlacement,
    Wall,
} from '@shared/map/MapData';

import type { ItemKind, ItemRef, EditorWorkingState } from '../state/EditorWorkingState';
import type { EditorContentSublayers } from '../viewport/editorSceneGraph';
import type { DragOverlay, DragDelta } from '../drag/dragOverlay';

import { buildWallContainer } from './walls';
import { buildObjectContainer } from './objects';
import { buildEntityContainer } from './entities';
import { buildDecalContainer } from './decals';
import { buildLightContainer } from './lights';
import { buildZoneContainer } from './zones';
import { buildNavHintContainer } from './navHints';
import { applyVisibility, flagsFor } from './layerVisibility';
import { applyBehindGlass } from './behindGlass';
import { SpriteCache } from './spriteCache';
import { boundsOfGUID, aabbContainsPoint } from '../selection/boundsOf';
import { LAYER_COLORS } from '@shared/render/layerColors';

export class EditorMapRenderer {
    private cache: SpriteCache;
    private byGUID = new Map<string, Container>();
    private cacheUnsubscribe: (() => void) | null = null;
    private overlayUnsubscribe: (() => void) | null = null;
    private state: EditorWorkingState;
    private dragOverlay: DragOverlay | null = null;

    constructor(
        state: EditorWorkingState,
        private readonly sublayers: EditorContentSublayers,
        dragOverlay?: DragOverlay,
    ) {
        this.state = state;
        this.cache = new SpriteCache(state.map.meta.id);
        this.cacheUnsubscribe = this.cache.onLoaded(() => this.rebuild());
        if (dragOverlay) {
            this.dragOverlay = dragOverlay;
            this.overlayUnsubscribe = dragOverlay.subscribe(() => this.rebuild());
        }
    }

    /** Expose the sprite cache so tools can build previews sharing texture state. */
    getSpriteCache(): SpriteCache {
        return this.cache;
    }

    /** Replace the working state pointer (e.g. on Open) and re-init the sprite cache. */
    setState(state: EditorWorkingState): void {
        this.state = state;
        this.cache.setMapId(state.map.meta.id);
        this.rebuild();
    }

    /** Rebuild every sublayer from scratch. */
    rebuild(): void {
        this.byGUID.clear();
        this.clearSublayer(this.sublayers.wall);
        this.clearSublayer(this.sublayers.object);
        this.clearSublayer(this.sublayers.entity);
        this.clearSublayer(this.sublayers.decal);
        this.clearSublayer(this.sublayers.light);
        this.clearSublayer(this.sublayers.zone);
        this.clearSublayer(this.sublayers.navHint);

        const activeFloor = this.state.activeFloorId;
        const activeLayer = this.state.activeLayerId;

        for (const layer of this.state.map.layers) {
            if (layer.floorId !== activeFloor) continue;
            this.renderLayer(layer, layer.id === activeLayer);
        }

        const hidden = this.state.editorHiddenGUIDs;
        for (const zone of this.state.map.zones) {
            if (zone.floorId && zone.floorId !== activeFloor) continue;
            if (zone.hidden === true || hidden.has(zone.id)) continue;
            const c = buildZoneContainer(zone);
            if (zone.locked === true) {
                c.eventMode = 'none';
                c.interactive = false;
            }
            this.byGUID.set(zone.id, c);
            this.sublayers.zone.addChild(c);
        }

        for (const hint of this.state.map.navHints) {
            if (hint.hidden === true || hidden.has(hint.id)) continue;
            const c = buildNavHintContainer(hint);
            if (hint.locked === true) {
                c.eventMode = 'none';
                c.interactive = false;
            }
            this.byGUID.set(hint.id, c);
            this.sublayers.navHint.addChild(c);
        }

        this.applyDragOverlay();
    }

    /** Container for a given GUID, or undefined if not currently rendered. */
    containerFor(guid: string): Container | undefined {
        return this.byGUID.get(guid);
    }

    /** Topmost selectable item under the world point, or null. */
    hitTest(worldX: number, worldY: number): string | null {
        const sublayerOrder: Container[] = [
            this.sublayers.zone,
            this.sublayers.navHint,
            this.sublayers.light,
            this.sublayers.entity,
            this.sublayers.object,
            this.sublayers.wall,
            this.sublayers.decal,
        ];
        for (const sl of sublayerOrder) {
            for (let i = sl.children.length - 1; i >= 0; i--) {
                const c = sl.children[i];
                if (!c.visible || c.eventMode === 'none') continue;
                const guid = c.label;
                if (!guid) continue;
                if (this.isItemHiddenOrLocked(guid)) continue;
                const aabb = boundsOfGUID(this.state, guid);
                if (aabb.width === 0 && aabb.height === 0) continue;
                if (!aabbContainsPoint(aabb, worldX, worldY)) continue;
                return guid;
            }
        }
        return null;
    }

    /** Every selectable item under the world point, ordered topmost-first. */
    hitTestAll(worldX: number, worldY: number): string[] {
        const sublayerOrder: Container[] = [
            this.sublayers.zone,
            this.sublayers.navHint,
            this.sublayers.light,
            this.sublayers.entity,
            this.sublayers.object,
            this.sublayers.wall,
            this.sublayers.decal,
        ];
        return hitTestAllImpl(
            this.state,
            sublayerOrder,
            worldX,
            worldY,
            (guid) => this.isItemHiddenOrLocked(guid),
        );
    }

    private isItemHiddenOrLocked(guid: string): boolean {
        const ref = this.state.byGUID.get(guid);
        if (!ref) return false;
        const map = this.state.map;
        switch (ref.kind) {
            case 'wall': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.walls.find((w) => w.id === guid);
                return item?.hidden === true || item?.locked === true;
            }
            case 'object': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.objects.find((o) => o.id === guid);
                return item?.hidden === true || item?.locked === true;
            }
            case 'entity': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.entities.find((e) => e.id === guid);
                return item?.hidden === true || item?.locked === true;
            }
            case 'decal': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.decals.find((d) => d.id === guid);
                return item?.hidden === true || item?.locked === true;
            }
            case 'light': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.lights.find((l) => l.id === guid);
                return item?.hidden === true || item?.locked === true;
            }
            case 'zone': {
                const item = map.zones.find((z) => z.id === guid);
                return item?.hidden === true || item?.locked === true;
            }
            case 'navHint': {
                const item = map.navHints.find((n) => n.id === guid);
                return item?.hidden === true || item?.locked === true;
            }
        }
    }

    destroy(): void {
        this.cacheUnsubscribe?.();
        this.cacheUnsubscribe = null;
        this.overlayUnsubscribe?.();
        this.overlayUnsubscribe = null;
        this.byGUID.clear();
    }

    private renderLayer(layer: MapLayer, isActive: boolean): void {
        const hidden = this.state.editorHiddenGUIDs;
        for (const w of layer.walls)
            this.addItem(layer, w, isActive, hidden, this.sublayers.wall, buildWallFor);
        for (const o of layer.objects)
            this.addItem(layer, o, isActive, hidden, this.sublayers.object, this.buildObjectFor);
        for (const e of layer.entities)
            this.addItem(layer, e, isActive, hidden, this.sublayers.entity, this.buildEntityFor);
        for (const d of layer.decals)
            this.addItem(layer, d, isActive, hidden, this.sublayers.decal, this.buildDecalFor);
        for (const l of layer.lights)
            this.addItem(layer, l, isActive, hidden, this.sublayers.light, buildLightFor);
    }

    private addItem<T extends { id: string; hidden?: boolean; locked?: boolean }>(
        layer: MapLayer,
        item: T,
        isActive: boolean,
        hidden: Set<string>,
        target: Container,
        builder: (item: T, ctx: BuildContext) => Container,
    ): void {
        const ctx: BuildContext = { state: this.state, cache: this.cache };
        const c = builder.call(this, item, ctx);
        const flags = flagsFor(layer, item, hidden);
        if (!applyVisibility(c, flags)) {
            c.destroy({ children: true });
            return;
        }
        applyBehindGlass(c, isActive, layer.locked || item.locked === true);
        this.byGUID.set(item.id, c);
        target.addChild(c);
    }

    private clearSublayer(c: Container): void {
        for (const child of [...c.children]) child.destroy({ children: true });
    }

    private applyDragOverlay(): void {
        if (!this.dragOverlay?.isActive()) return;
        for (const [guid, delta] of this.dragOverlay.entries()) {
            const ghost = this.byGUID.get(guid);
            if (!ghost) continue;
            ghost.visible = false;

            const ref = this.state.byGUID.get(guid);
            if (!ref) continue;

            const aabb = boundsOfGUID(this.state, guid);
            if (aabb.width > 0 && aabb.height > 0) {
                const colour = ghostColourFor(this.state, ref);
                const ghostG = new Graphics();
                ghostG.rect(aabb.x, aabb.y, aabb.width, aabb.height)
                    .stroke({ color: colour, width: 1, alpha: 0.2 });
                this.sublayerForKind(ref.kind)?.addChild(ghostG);
            }

            const preview = this.buildContainerFor(ref);
            if (!preview) continue;
            applyDeltaTransform(preview, delta);
            this.sublayerForKind(ref.kind)?.addChild(preview);
        }
    }

    private sublayerForKind(kind: ItemKind): Container | null {
        switch (kind) {
            case 'wall':    return this.sublayers.wall;
            case 'object':  return this.sublayers.object;
            case 'entity':  return this.sublayers.entity;
            case 'decal':   return this.sublayers.decal;
            case 'light':   return this.sublayers.light;
            case 'zone':    return this.sublayers.zone;
            case 'navHint': return this.sublayers.navHint;
            default:        return null;
        }
    }

    private buildContainerFor(ref: ItemRef): Container | null {
        const map = this.state.map;
        switch (ref.kind) {
            case 'wall': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.walls.find((w) => w.id === ref.guid);
                return item ? buildWallContainer(item) : null;
            }
            case 'object': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.objects.find((o) => o.id === ref.guid);
                if (!item) return null;
                const def = map.objectDefs.find((d) => d.id === item.objectDefId);
                return buildObjectContainer(item, def, this.cache);
            }
            case 'entity': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.entities.find((e) => e.id === ref.guid);
                if (!item) return null;
                const def = map.entityDefs.find((d) => d.id === item.entityTypeId);
                return buildEntityContainer(item, def, this.cache);
            }
            case 'decal': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.decals.find((d) => d.id === ref.guid);
                return item ? buildDecalContainer(item, this.cache) : null;
            }
            case 'light': {
                const layer = map.layers.find((l) => l.id === ref.layerId);
                const item = layer?.lights.find((l) => l.id === ref.guid);
                return item ? buildLightContainer(item) : null;
            }
            case 'zone': {
                const item = map.zones.find((z) => z.id === ref.guid);
                return item ? buildZoneContainer(item) : null;
            }
            case 'navHint': {
                const item = map.navHints.find((n) => n.id === ref.guid);
                return item ? buildNavHintContainer(item) : null;
            }
        }
    }

    private buildObjectFor = (p: ObjectPlacement, ctx: BuildContext): Container => {
        const def = ctx.state.map.objectDefs.find((d) => d.id === p.objectDefId);
        return buildObjectContainer(p, def, ctx.cache);
    };

    private buildEntityFor = (p: EntityPlacement, ctx: BuildContext): Container => {
        const def = ctx.state.map.entityDefs.find((d) => d.id === p.entityTypeId);
        return buildEntityContainer(p, def, ctx.cache);
    };

    private buildDecalFor = (p: DecalPlacement, ctx: BuildContext): Container => {
        return buildDecalContainer(p, ctx.cache);
    };
}

interface BuildContext {
    state: EditorWorkingState;
    cache: SpriteCache;
}

function ghostColourFor(state: EditorWorkingState, ref: ItemRef): number {
    if (!ref.layerId) return 0x00e5ff;
    const layer = state.map.layers.find((l) => l.id === ref.layerId);
    if (!layer) return 0x00e5ff;
    return LAYER_COLORS[layer.type].hex;
}

function buildWallFor(w: Wall): Container {
    return buildWallContainer(w);
}

function buildLightFor(l: LightPlacement): Container {
    return buildLightContainer(l);
}

/**
 * Pure hit-testing routine shared by `EditorMapRenderer.hitTestAll`. Walks
 * `sublayerOrder` front-to-back (as provided) and inside each sublayer walks
 * children from highest index to lowest, collecting every GUID whose AABB
 * contains the world point. Skips children that are invisible, have no label,
 * or are reported hidden/locked by `isHiddenOrLocked`.
 */
export function hitTestAllImpl(
    state: EditorWorkingState,
    sublayerOrder: Container[],
    worldX: number,
    worldY: number,
    isHiddenOrLocked: (guid: string) => boolean,
): string[] {
    const out: string[] = [];
    for (const sl of sublayerOrder) {
        for (let i = sl.children.length - 1; i >= 0; i--) {
            const c = sl.children[i];
            if (!c.visible || c.eventMode === 'none') continue;
            const guid = c.label;
            if (!guid) continue;
            if (isHiddenOrLocked(guid)) continue;
            const aabb = boundsOfGUID(state, guid);
            if (aabb.width === 0 && aabb.height === 0) continue;
            if (!aabbContainsPoint(aabb, worldX, worldY)) continue;
            out.push(guid);
        }
    }
    return out;
}

function applyDeltaTransform(container: Container, delta: DragDelta): void {
    if (delta.dRotation !== 0 && delta.pivotX !== undefined && delta.pivotY !== undefined) {
        container.pivot.set(delta.pivotX, delta.pivotY);
        container.position.set(delta.pivotX, delta.pivotY);
        container.rotation = delta.dRotation;
    } else if ((delta.scaleX !== 1 || delta.scaleY !== 1) && delta.pivotX !== undefined && delta.pivotY !== undefined) {
        container.pivot.set(delta.pivotX, delta.pivotY);
        container.position.set(delta.pivotX, delta.pivotY);
        container.scale.set(delta.scaleX, delta.scaleY);
    } else {
        container.x = delta.dx;
        container.y = delta.dy;
    }
}
