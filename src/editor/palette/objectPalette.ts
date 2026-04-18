/**
 * Object palette body. Renders search field + recents + grid of object def
 * thumbnails. Picking an entry calls `onPick(defId)`.
 *
 * Part of the editor layer.
 */

import type { ObjectDefinition } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { PaletteRecents } from '../persistence/editorStatePersistence';
import { getRecents } from './paletteRecents';
import { buildSpriteThumbnail } from './spriteThumbnail';

export interface ObjectPaletteOptions {
    state: EditorWorkingState;
    recents: PaletteRecents;
    onPick: (defId: string) => void;
}

/** Build (or replace) the palette body in `container`. Returns a refresh function. */
export function mountObjectPalette(container: HTMLElement, opts: ObjectPaletteOptions): () => void {
    container.innerHTML = '';
    container.classList.add('editor-palette', 'editor-palette-object');

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search objects...';
    search.className = 'editor-palette-search';
    container.appendChild(search);

    const recentsHeader = document.createElement('div');
    recentsHeader.className = 'editor-palette-section';
    recentsHeader.textContent = 'Recent';
    const recentsGrid = document.createElement('div');
    recentsGrid.className = 'editor-palette-grid';
    container.appendChild(recentsHeader);
    container.appendChild(recentsGrid);

    const allHeader = document.createElement('div');
    allHeader.className = 'editor-palette-section';
    allHeader.textContent = 'All';
    const allGrid = document.createElement('div');
    allGrid.className = 'editor-palette-grid';
    container.appendChild(allHeader);
    container.appendChild(allGrid);

    const refresh = (): void => {
        const filter = search.value.trim().toLowerCase();
        recentsGrid.innerHTML = '';
        allGrid.innerHTML = '';

        const recentIds = getRecents(opts.recents, 'object');
        const recentDefs = recentIds
            .map((id) => opts.state.map.objectDefs.find((d) => d.id === id))
            .filter((d): d is NonNullable<typeof d> => Boolean(d));

        for (const def of recentDefs) {
            if (filter && !defMatches(def.id, def.label, filter)) continue;
            recentsGrid.appendChild(buildEntry(def, opts.state.map.meta.id, opts.onPick));
        }

        for (const def of opts.state.map.objectDefs) {
            if (filter && !defMatches(def.id, def.label, filter)) continue;
            allGrid.appendChild(buildEntry(def, opts.state.map.meta.id, opts.onPick));
        }

        recentsHeader.style.display = recentDefs.length === 0 ? 'none' : '';
    };

    search.addEventListener('input', refresh);
    refresh();
    return refresh;
}

function defMatches(id: string, label: string, filter: string): boolean {
    return id.toLowerCase().includes(filter) || label.toLowerCase().includes(filter);
}

function buildEntry(
    def: ObjectDefinition,
    mapId: string,
    onPick: (defId: string) => void,
): HTMLElement {
    const wrap = document.createElement('button');
    wrap.type = 'button';
    wrap.className = 'editor-palette-entry';
    wrap.appendChild(buildSpriteThumbnail(def, mapId));
    const label = document.createElement('div');
    label.className = 'editor-palette-entry-label';
    label.textContent = def.label;
    wrap.appendChild(label);
    wrap.addEventListener('click', () => onPick(def.id));
    return wrap;
}
