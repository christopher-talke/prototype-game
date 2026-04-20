/**
 * Visibility / lock styling for editor item containers.
 *
 * - layer.visible=false → container removed from render
 * - layer.locked=true → container rendered but eventMode='none' (no clicks)
 * - editorHiddenGUIDs contains item.id → container removed from render
 * - item.hidden=true → container removed from render
 * - item.locked=true → container rendered but eventMode='none' (no clicks)
 * - active vs non-active layer → "behind glass" muting via behindGlass.ts
 *
 * Part of the editor layer.
 */

import type { Container } from 'pixi.js';

import type { MapLayer } from '@shared/map/MapData';

export interface VisibilityFlags {
    layerVisible: boolean;
    layerLocked: boolean;
    itemHidden: boolean;
    itemLocked: boolean;
}

/** Apply visibility + lock to a per-item Container. Returns true if it should render. */
export function applyVisibility(c: Container, flags: VisibilityFlags): boolean {
    if (!flags.layerVisible || flags.itemHidden) {
        c.visible = false;
        c.eventMode = 'none';
        return false;
    }
    c.visible = true;
    const locked = flags.layerLocked || flags.itemLocked;
    c.eventMode = locked ? 'none' : 'static';
    c.interactive = !locked;
    return true;
}

/** Convenience: pull flags from a layer + the editor-hidden set + the item's own flags. */
export function flagsFor(
    layer: MapLayer,
    item: { id: string; hidden?: boolean; locked?: boolean },
    editorHiddenGUIDs: Set<string>,
): VisibilityFlags {
    return {
        layerVisible: layer.visible,
        layerLocked: layer.locked,
        itemHidden: editorHiddenGUIDs.has(item.id) || item.hidden === true,
        itemLocked: item.locked === true,
    };
}
