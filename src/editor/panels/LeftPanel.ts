/**
 * Left panel shell. Phase 2: tab bar (Layers | Objects | Entities), floor
 * selector, layer list, item list, palettes.
 *
 * Part of the editor layer.
 */

import { type PanelCollapse, loadPanelCollapse, savePanelCollapse } from './panelLayoutPersistence';
import { mountFloorSelector } from './leftPanel/floorSelector';
import { mountLayerList } from './leftPanel/layerList';
import { mountItemList } from './leftPanel/itemList';
import { mountObjectPalette } from '../palette/objectPalette';
import { mountEntityPalette } from '../palette/entityPalette';
import { mountKindList } from './leftPanel/itemList';
import type { CommandStack } from '../commands/CommandStack';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { EditorStatePersisted } from '../persistence/editorStatePersistence';
import type { SelectionStore } from '../selection/selectionStore';
import type { EditorCamera } from '../viewport/EditorCamera';
import type { ToolManager } from '../tools/toolManager';

export type LeftPanelTab = 'layers' | 'objects' | 'entities' | 'zones' | 'lights' | 'nav';

export interface LeftPanelDeps {
    state: EditorWorkingState;
    stack: CommandStack;
    persisted: EditorStatePersisted;
    selection: SelectionStore;
    camera: EditorCamera;
    tools: ToolManager;
    onPersist: () => void;
    onActiveLayerChange: () => void;
    onFloorChange: () => void;
    onHiddenChange: () => void;
}

export interface LeftPanelHandle {
    refreshFloors: () => void;
    refreshLayers: () => void;
    refreshItems: () => void;
    refreshPalettes: () => void;
    setTab: (tab: LeftPanelTab) => void;
}

export function mountLeftPanel(
    container: HTMLElement,
    root: HTMLElement,
    deps: LeftPanelDeps,
): LeftPanelHandle {
    const collapse = loadPanelCollapse();
    applyCollapseClass(container, root, 'left', collapse.left);

    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'editor-panel-header';
    header.textContent = 'Structure';
    container.appendChild(header);

    const tabBar = document.createElement('div');
    tabBar.className = 'editor-tab-bar';
    container.appendChild(tabBar);

    const tabs: Array<{ id: LeftPanelTab; label: string; el: HTMLButtonElement }> = [];
    for (const def of [
        { id: 'layers' as const, label: 'Layers' },
        { id: 'objects' as const, label: 'Objects' },
        { id: 'entities' as const, label: 'Entities' },
        { id: 'zones' as const, label: 'Zones' },
        { id: 'lights' as const, label: 'Lights' },
        { id: 'nav' as const, label: 'Nav' },
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'editor-tab';
        btn.textContent = def.label;
        btn.addEventListener('click', () => setTab(def.id));
        tabBar.appendChild(btn);
        tabs.push({ id: def.id, label: def.label, el: btn });
    }

    const body = document.createElement('div');
    body.className = 'editor-panel-body editor-left-body';
    container.appendChild(body);

    const layersPane = document.createElement('div');
    layersPane.className = 'editor-pane editor-pane-layers';
    body.appendChild(layersPane);

    const floorHost = document.createElement('div');
    layersPane.appendChild(floorHost);

    const layerListHost = document.createElement('div');
    layersPane.appendChild(layerListHost);

    const itemListHost = document.createElement('div');
    layersPane.appendChild(itemListHost);

    const objectsPane = document.createElement('div');
    objectsPane.className = 'editor-pane editor-pane-objects';
    body.appendChild(objectsPane);

    const entitiesPane = document.createElement('div');
    entitiesPane.className = 'editor-pane editor-pane-entities';
    body.appendChild(entitiesPane);

    const zonesPane = document.createElement('div');
    zonesPane.className = 'editor-pane editor-pane-zones';
    body.appendChild(zonesPane);

    const lightsPane = document.createElement('div');
    lightsPane.className = 'editor-pane editor-pane-lights';
    body.appendChild(lightsPane);

    const navPane = document.createElement('div');
    navPane.className = 'editor-pane editor-pane-nav';
    body.appendChild(navPane);

    const collapsedOnly = document.createElement('div');
    collapsedOnly.className = 'editor-panel-collapsed-only';
    collapsedOnly.textContent = 'L';
    container.appendChild(collapsedOnly);

    const chevron = document.createElement('button');
    chevron.className = 'editor-chevron';
    chevron.title = 'Collapse/expand';
    chevron.textContent = collapse.left ? '>' : '<';
    container.appendChild(chevron);

    chevron.addEventListener('click', () => {
        const next = !container.classList.contains('collapsed');
        applyCollapseClass(container, root, 'left', next);
        const state: PanelCollapse = loadPanelCollapse();
        state.left = next;
        savePanelCollapse(state);
        chevron.textContent = next ? '>' : '<';
    });

    const refreshFloors = mountFloorSelector(floorHost, {
        state: deps.state,
        camera: deps.camera,
        persisted: deps.persisted,
        selection: deps.selection,
        onFloorChange: () => {
            deps.onFloorChange();
            refreshLayers();
            refreshItems();
        },
        onPersist: deps.onPersist,
    });

    const refreshLayers = mountLayerList(layerListHost, {
        state: deps.state,
        stack: deps.stack,
        onActiveLayerChange: () => {
            deps.onActiveLayerChange();
            refreshItems();
        },
        onPersist: deps.onPersist,
    });

    const refreshItems = mountItemList(itemListHost, {
        state: deps.state,
        selection: deps.selection,
        camera: deps.camera,
        onHiddenChange: deps.onHiddenChange,
    });

    const kindListOpts = {
        state: deps.state,
        selection: deps.selection,
        camera: deps.camera,
        onHiddenChange: deps.onHiddenChange,
    };
    const refreshZoneList = mountKindList(zonesPane, ['zone'], kindListOpts);
    const refreshLightList = mountKindList(lightsPane, ['light'], kindListOpts);
    const refreshNavList = mountKindList(navPane, ['navHint'], kindListOpts);

    const refreshObjectPalette = mountObjectPalette(objectsPane, {
        state: deps.state,
        recents: deps.persisted.paletteRecents,
        onPick: (defId) => {
            deps.tools.activate('object', { defId });
            setTab('layers');
        },
    });

    const refreshEntityPalette = mountEntityPalette(entitiesPane, {
        state: deps.state,
        recents: deps.persisted.paletteRecents,
        onPick: (defId) => {
            deps.tools.activate('entity', { defId });
            setTab('layers');
        },
    });

    const setTab = (tab: LeftPanelTab): void => {
        for (const t of tabs) {
            t.el.classList.toggle('active', t.id === tab);
        }
        layersPane.style.display = tab === 'layers' ? '' : 'none';
        objectsPane.style.display = tab === 'objects' ? '' : 'none';
        entitiesPane.style.display = tab === 'entities' ? '' : 'none';
        zonesPane.style.display = tab === 'zones' ? '' : 'none';
        lightsPane.style.display = tab === 'lights' ? '' : 'none';
        navPane.style.display = tab === 'nav' ? '' : 'none';
    };
    setTab('layers');

    const refreshAllItems = () => {
        refreshItems();
        refreshZoneList();
        refreshLightList();
        refreshNavList();
    };

    deps.selection.subscribe(refreshAllItems);
    deps.stack.subscribe(() => {
        refreshFloors();
        refreshLayers();
        refreshAllItems();
        refreshObjectPalette();
        refreshEntityPalette();
    });

    return {
        refreshFloors,
        refreshLayers,
        refreshItems: refreshAllItems,
        refreshPalettes: () => {
            refreshObjectPalette();
            refreshEntityPalette();
        },
        setTab,
    };
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
