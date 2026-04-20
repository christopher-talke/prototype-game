/**
 * Single row in the layer list. Shows type badge, label, eye toggle, lock
 * toggle, and an active-layer highlight in the layer's colour.
 *
 * Part of the editor layer.
 */

import type { MapLayer } from '@shared/map/MapData';

import { LAYER_COLORS } from '@shared/render/layerColors';
import { beginInlineRename } from './inlineRename';

export interface LayerListItemOptions {
    layer: MapLayer;
    isActive: boolean;
    hasError: boolean;
    onActivate: () => void;
    onToggleVisibility: () => void;
    onToggleLock: () => void;
    onRename: (next: string) => void;
}

export interface LayerListItemHandle {
    readonly el: HTMLElement;
    beginRename: () => void;
}

/** Build a layer-row element. */
export function buildLayerListItem(opts: LayerListItemOptions): LayerListItemHandle {
    const colors = LAYER_COLORS[opts.layer.type];

    const row = document.createElement('div');
    row.className = 'editor-layer-row';
    row.dataset.guid = opts.layer.id;
    if (opts.isActive) row.classList.add('active');
    row.style.borderLeftColor = colors.css;

    const badge = document.createElement('span');
    badge.className = 'editor-layer-badge';
    badge.style.background = colors.css;
    badge.textContent = colors.badge;
    row.appendChild(badge);

    const name = document.createElement('span');
    name.className = 'editor-layer-name';
    name.textContent = opts.layer.label;
    row.appendChild(name);

    if (opts.hasError) {
        const badge = document.createElement('span');
        badge.className = 'layer-error-badge';
        badge.title = 'This layer has compile errors';
        row.appendChild(badge);
    }

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'editor-layer-eye';
    eye.title = opts.layer.visible ? 'Hide layer' : 'Show layer';
    eye.textContent = opts.layer.visible ? 'O' : '-';
    eye.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onToggleVisibility();
    });
    row.appendChild(eye);

    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'editor-layer-lock';
    lock.title = opts.layer.locked ? 'Unlock layer' : 'Lock layer';
    lock.textContent = opts.layer.locked ? 'L' : 'U';
    lock.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onToggleLock();
    });
    row.appendChild(lock);

    row.addEventListener('click', () => opts.onActivate());

    const beginRename = (): void => {
        beginInlineRename(name, opts.layer.label, opts.onRename);
    };

    name.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        beginRename();
    });

    return { el: row, beginRename };
}
