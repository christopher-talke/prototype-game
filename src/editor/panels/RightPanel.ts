/**
 * Right panel shell. Phase 2: context-sensitive property editor.
 *
 * Subscribes to the SelectionStore and the CommandStack: rebuilds the
 * appropriate per-kind form whenever selection or map data changes.
 *
 * Part of the editor layer.
 */

import type {
    DecalPlacement,
    EntityPlacement,
    LightPlacement,
    MapData,
    NavHint,
    ObjectPlacement,
    Wall,
    Zone,
} from '@shared/map/MapData';

import type { CommandStack } from '../commands/CommandStack';
import type { EditorWorkingState, ItemRef } from '../state/EditorWorkingState';
import type { SelectionStore } from '../selection/selectionStore';
import { type PanelCollapse, loadPanelCollapse, savePanelCollapse } from './panelLayoutPersistence';
import { renderPropertyForm } from './rightPanel/propertyForm';
import { buildAdvancedSection } from './rightPanel/advancedSection';
import { wallFormFields } from './rightPanel/forms/wallForm';
import { objectFormFields } from './rightPanel/forms/objectForm';
import { entityFormFields } from './rightPanel/forms/entityForm';
import { zoneFormFields } from './rightPanel/forms/zoneForm';
import { lightFormFields } from './rightPanel/forms/lightForm';
import { navHintFormFields } from './rightPanel/forms/navHintForm';
import { decalFormFields } from './rightPanel/forms/decalForm';
import { multiSelectFormFields } from './rightPanel/forms/multiSelectForm';
import { groupFormFields } from './rightPanel/forms/groupForm';
import { findGroupForExactSelection } from '../groups/groupQueries';

export interface RightPanelDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
}

export interface RightPanelHandle {
    refresh: () => void;
}

export function mountRightPanel(
    container: HTMLElement,
    root: HTMLElement,
    deps: RightPanelDeps,
): RightPanelHandle {
    const collapse = loadPanelCollapse();
    applyCollapseClass(container, root, 'right', collapse.right);

    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'editor-panel-header';
    header.textContent = 'Properties';
    container.appendChild(header);

    const body = document.createElement('div');
    body.className = 'editor-panel-body editor-right-body';
    container.appendChild(body);

    const collapsedOnly = document.createElement('div');
    collapsedOnly.className = 'editor-panel-collapsed-only';
    collapsedOnly.textContent = 'R';
    container.appendChild(collapsedOnly);

    const chevron = document.createElement('button');
    chevron.className = 'editor-chevron';
    chevron.title = 'Collapse/expand';
    chevron.textContent = collapse.right ? '<' : '>';
    container.appendChild(chevron);

    chevron.addEventListener('click', () => {
        const next = !container.classList.contains('collapsed');
        applyCollapseClass(container, root, 'right', next);
        const state: PanelCollapse = loadPanelCollapse();
        state.right = next;
        savePanelCollapse(state);
        chevron.textContent = next ? '<' : '>';
    });

    const refresh = (): void => rebuildBody(body, deps);

    deps.selection.subscribe(refresh);
    deps.stack.subscribe(refresh);

    refresh();

    return { refresh };
}

function rebuildBody(body: HTMLElement, deps: RightPanelDeps): void {
    body.innerHTML = '';

    const selected = deps.selection.selectedArray();
    if (selected.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'editor-properties-empty';
        empty.textContent = 'Select an item to edit its properties.';
        body.appendChild(empty);
        return;
    }

    const formHost = document.createElement('div');
    formHost.className = 'editor-properties-form-host';
    body.appendChild(formHost);

    const group = findGroupForExactSelection(deps.state, selected);
    if (group) {
        renderPropertyForm(formHost, groupFormFields(deps.state, deps.stack, deps.selection, group));
        return;
    }

    if (selected.length === 1) {
        const guid = selected[0];
        const ref = deps.state.byGUID.get(guid);
        if (!ref) {
            const missing = document.createElement('div');
            missing.className = 'editor-properties-empty';
            missing.textContent = 'Selected item no longer exists.';
            body.appendChild(missing);
            return;
        }
        const fields = buildFieldsFor(deps, ref);
        renderPropertyForm(formHost, fields);
        body.appendChild(buildAdvancedSection(guid));
        return;
    }

    const refs: ItemRef[] = [];
    for (const guid of selected) {
        const ref = deps.state.byGUID.get(guid);
        if (ref) refs.push(ref);
    }
    renderPropertyForm(formHost, multiSelectFormFields(deps.state, deps.stack, refs));
}

function buildFieldsFor(deps: RightPanelDeps, ref: ItemRef): ReturnType<typeof wallFormFields> {
    const { state, stack } = deps;
    switch (ref.kind) {
        case 'wall': {
            const wall = findWall(state.map, ref.guid);
            return wall ? wallFormFields(state, stack, wall) : [];
        }
        case 'object': {
            const obj = findObject(state.map, ref.guid);
            return obj ? objectFormFields(state, stack, obj) : [];
        }
        case 'entity': {
            const ent = findEntity(state.map, ref.guid);
            return ent ? entityFormFields(state, stack, ent) : [];
        }
        case 'decal': {
            const dec = findDecal(state.map, ref.guid);
            return dec ? decalFormFields(state, stack, dec) : [];
        }
        case 'light': {
            const light = findLight(state.map, ref.guid);
            return light ? lightFormFields(state, stack, light) : [];
        }
        case 'zone': {
            const zone = findZone(state.map, ref.guid);
            return zone ? zoneFormFields(state, stack, zone) : [];
        }
        case 'navHint': {
            const hint = findNavHint(state.map, ref.guid);
            return hint ? navHintFormFields(state, stack, hint) : [];
        }
    }
}

function findWall(map: MapData, guid: string): Wall | undefined {
    for (const layer of map.layers) {
        const w = layer.walls.find((x) => x.id === guid);
        if (w) return w;
    }
    return undefined;
}

function findObject(map: MapData, guid: string): ObjectPlacement | undefined {
    for (const layer of map.layers) {
        const o = layer.objects.find((x) => x.id === guid);
        if (o) return o;
    }
    return undefined;
}

function findEntity(map: MapData, guid: string): EntityPlacement | undefined {
    for (const layer of map.layers) {
        const e = layer.entities.find((x) => x.id === guid);
        if (e) return e;
    }
    return undefined;
}

function findDecal(map: MapData, guid: string): DecalPlacement | undefined {
    for (const layer of map.layers) {
        const d = layer.decals.find((x) => x.id === guid);
        if (d) return d;
    }
    return undefined;
}

function findLight(map: MapData, guid: string): LightPlacement | undefined {
    for (const layer of map.layers) {
        const l = layer.lights.find((x) => x.id === guid);
        if (l) return l;
    }
    return undefined;
}

function findZone(map: MapData, guid: string): Zone | undefined {
    return map.zones.find((z) => z.id === guid);
}

function findNavHint(map: MapData, guid: string): NavHint | undefined {
    return map.navHints.find((n) => n.id === guid);
}

function applyCollapseClass(
    panel: HTMLElement,
    root: HTMLElement,
    side: 'left' | 'right',
    collapsed: boolean,
): void {
    panel.classList.toggle('collapsed', collapsed);
    root.classList.toggle(`${side}-collapsed`, collapsed);
}
