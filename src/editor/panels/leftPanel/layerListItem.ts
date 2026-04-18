/**
 * Single row in the layer list. Shows type badge, label, eye toggle, lock
 * toggle, and an active-layer highlight in the layer's colour.
 *
 * Part of the editor layer.
 */

import type { MapLayer } from '@shared/map/MapData';

import { LAYER_COLORS } from '@shared/render/layerColors';

export interface LayerListItemOptions {
    layer: MapLayer;
    isActive: boolean;
    onActivate: () => void;
    onToggleVisibility: () => void;
    onToggleLock: () => void;
    onRename: (next: string) => void;
}

/** Build a layer-row element. */
export function buildLayerListItem(opts: LayerListItemOptions): HTMLElement {
    const colors = LAYER_COLORS[opts.layer.type];

    const row = document.createElement('div');
    row.className = 'editor-layer-row';
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

    name.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        beginRename(name, opts.layer.label, opts.onRename);
    });

    return row;
}

function beginRename(target: HTMLElement, current: string, commit: (next: string) => void): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'editor-layer-rename-input';
    target.replaceWith(input);
    input.focus();
    input.select();

    const finish = (save: boolean) => {
        const next = input.value.trim();
        const out = document.createElement('span');
        out.className = 'editor-layer-name';
        out.textContent = save && next ? next : current;
        input.replaceWith(out);
        if (save && next && next !== current) commit(next);
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
        }
    });
}
