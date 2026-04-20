/**
 * Left panel shell. Mounts the unified collapsible tree (floor selector,
 * layer list, per-kind item sections, object/entity palettes).
 *
 * Part of the editor layer.
 */

import { type PanelCollapse, loadPanelCollapse, savePanelCollapse } from './panelLayoutPersistence';
import { mountUnifiedTree, type UnifiedTreeHandle } from './leftPanel/unifiedTree';
import { mountBreadcrumb } from './leftPanel/breadcrumb';
import type { CommandStack } from '../commands/CommandStack';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { EditorStatePersisted } from '../persistence/editorStatePersistence';
import type { SelectionStore } from '../selection/selectionStore';
import type { EditorCamera } from '../viewport/EditorCamera';
import type { ToolManager } from '../tools/toolManager';

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
    getErrorLayerIds?: () => Set<string>;
}

export interface LeftPanelHandle {
    refreshFloors: () => void;
    refreshLayers: () => void;
    refreshItems: () => void;
    refreshPalettes: () => void;
    beginRename: (guid: string) => void;
}

/** Mount the left panel into `container`. Returns the refresh handle. */
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

    const body = document.createElement('div');
    body.className = 'editor-panel-body editor-left-body';
    container.appendChild(body);

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

    const tree: UnifiedTreeHandle = mountUnifiedTree(body, {
        state: deps.state,
        stack: deps.stack,
        selection: deps.selection,
        camera: deps.camera,
        persisted: deps.persisted,
        tools: deps.tools,
        onHiddenChange: deps.onHiddenChange,
        onPersist: deps.onPersist,
        onActiveLayerChange: deps.onActiveLayerChange,
        onFloorChange: deps.onFloorChange,
        getErrorLayerIds: deps.getErrorLayerIds,
    });

    mountBreadcrumb(container, { state: deps.state, selection: deps.selection });

    deps.stack.subscribe(() => tree.refresh());

    return {
        refreshFloors: tree.refreshFloors,
        refreshLayers: tree.refreshLayers,
        refreshItems: tree.refresh,
        refreshPalettes: tree.refreshPalettes,
        beginRename: tree.beginRename,
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
