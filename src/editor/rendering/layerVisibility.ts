/**
 * Visibility / lock styling for editor item containers.
 *
 * - layer.visible=false → container removed from render
 * - layer.locked=true → container rendered but eventMode='none' (no clicks)
 * - editorHiddenGUIDs contains item.id → container removed from render
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
}

/** Apply visibility + lock to a per-item Container. Returns true if it should render. */
export function applyVisibility(c: Container, flags: VisibilityFlags): boolean {
    if (!flags.layerVisible || flags.itemHidden) {
        c.visible = false;
        c.eventMode = 'none';
        return false;
    }
    c.visible = true;
    c.eventMode = flags.layerLocked ? 'none' : 'static';
    c.interactive = !flags.layerLocked;
    return true;
}

/** Convenience: pull flags from a layer + the editor-hidden set. */
export function flagsFor(
    layer: MapLayer,
    itemId: string,
    editorHiddenGUIDs: Set<string>,
): VisibilityFlags {
    return {
        layerVisible: layer.visible,
        layerLocked: layer.locked,
        itemHidden: editorHiddenGUIDs.has(itemId),
    };
}
