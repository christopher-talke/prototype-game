/**
 * Lock-state query for placement items. An item is effectively locked if its
 * own `locked` flag is true OR its owning layer's `locked` flag is true.
 * Layerless items (zones, navHints) only check the item's own flag.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from './EditorWorkingState';

/** True when `guid` cannot be mutated or selected by tools. */
export function isItemLocked(state: EditorWorkingState, guid: string): boolean {
    const ref = state.byGUID.get(guid);
    if (!ref) return false;
    const itemLocked = lookupItemLocked(state, guid);
    if (itemLocked) return true;
    if (!ref.layerId) return false;
    const layer = state.map.layers.find((l) => l.id === ref.layerId);
    return layer?.locked === true;
}

function lookupItemLocked(state: EditorWorkingState, guid: string): boolean {
    for (const layer of state.map.layers) {
        for (const w of layer.walls) if (w.id === guid) return w.locked === true;
        for (const o of layer.objects) if (o.id === guid) return o.locked === true;
        for (const e of layer.entities) if (e.id === guid) return e.locked === true;
        for (const d of layer.decals) if (d.id === guid) return d.locked === true;
        for (const l of layer.lights) if (l.id === guid) return l.locked === true;
    }
    for (const z of state.map.zones) if (z.id === guid) return z.locked === true;
    for (const n of state.map.navHints) if (n.id === guid) return n.locked === true;
    return false;
}
