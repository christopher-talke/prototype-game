/**
 * Apply "behind glass" muting to items not on the active layer.
 *
 * Mutes alpha to 0.4 and disables hit testing so the user can only interact
 * with the active layer's items. Active-layer items render at full alpha.
 *
 * Part of the editor layer.
 */

import type { Container } from 'pixi.js';

const BEHIND_GLASS_ALPHA = 0.4;

/** Set alpha + eventMode based on whether the item belongs to the active layer. */
export function applyBehindGlass(c: Container, isActiveLayer: boolean, locked: boolean): void {
    if (isActiveLayer) {
        c.alpha = 1;
        if (!locked) {
            c.eventMode = 'static';
            c.interactive = true;
        }
    } else {
        c.alpha = BEHIND_GLASS_ALPHA;
        c.eventMode = 'none';
        c.interactive = false;
    }
}
