/**
 * Renders a 64-px square thumbnail for an object/entity definition.
 *
 * Uses the def's first sprite layer as the image src; falls back to a coloured
 * placeholder if the def has no sprites.
 *
 * Part of the editor layer.
 */

import type { ObjectDefinition, EntityTypeDefinition } from '@shared/map/MapData';

/** Build a 64x64 thumbnail element for the def. */
export function buildSpriteThumbnail(
    def: ObjectDefinition | EntityTypeDefinition,
    mapId: string,
): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'editor-palette-thumb';

    const first = def.sprites[0];
    if (first) {
        const img = document.createElement('img');
        img.src = `/maps/${mapId}/${first.assetPath}`;
        img.alt = def.label;
        img.draggable = false;
        wrap.appendChild(img);
    } else {
        const fallback = document.createElement('div');
        fallback.className = 'editor-palette-thumb-fallback';
        fallback.textContent = def.label.slice(0, 2).toUpperCase();
        wrap.appendChild(fallback);
    }
    return wrap;
}
