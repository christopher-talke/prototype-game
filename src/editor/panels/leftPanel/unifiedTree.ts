/**
 * Unified collapsible tree for the left panel. Replaces the old tabbed UI.
 *
 * Sections, top-to-bottom:
 *   Floor (header + floor selector)
 *   Layers      - every layer on the active floor
 *   Walls       - walls on the active layer
 *   Zones       - all zones on the active floor
 *   Objects     - objects on the active layer
 *   Entities    - entities on the active layer
 *   Lights      - lights on the active layer
 *   Decals      - decals on the active layer
 *   Nav Hints   - every nav hint (floor/layer-less)
 *   Object Palette / Entity Palette (collapsed by default)
 *
 * Per-section collapse state persists in `EditorStatePersisted.treeCollapse`.
 * A search input at the top narrows rows by case-insensitive substring match on
 * `ref.name` or the first 8 chars of `guid`. While a filter is active, every
 * section and group auto-expands but the persisted collapse map is not touched.
 *
 * Part of the editor layer.
 */

import type { CommandStack } from '../../commands/CommandStack';
import { buildSetItemLockCommand } from '../../commands/setItemLockCommand';
import { buildSetItemVisibilityCommand } from '../../commands/setItemVisibilityCommand';
import { buildRenameItemCommand } from '../../commands/renameItemCommand';
import { buildAddLayerCommand } from '../../commands/addLayerCommand';
import { buildDragReorderCommand } from '../../commands/buildDragReorderCommand';
import { buildMoveMemberCommand } from '../../commands/moveMemberCommand';
import {
    buildSetSectionFlagCommand,
    type SectionFlag,
    type SectionScope,
} from '../../commands/setSectionFlagsCommand';
import type { EditorWorkingState } from '../../state/EditorWorkingState';
import type { EditorStatePersisted } from '../../persistence/editorStatePersistence';
import type { SelectionStore } from '../../selection/selectionStore';
import type { EditorCamera } from '../../viewport/EditorCamera';
import { boundsOfGUID } from '../../selection/boundsOf';
import { mountFloorSelector } from './floorSelector';
import { mountLayerList } from './layerList';
import { buildItemListRow, renderHighlightedText } from './itemListRow';
import {
    ITEM_SECTIONS,
    collectSectionFlagState,
    collectSectionRows,
    resolveSectionCollapsed,
    type RowEntry,
    type SectionDef,
} from './unifiedTreeModel';
import { mountObjectPalette } from '../../palette/objectPalette';
import { mountEntityPalette } from '../../palette/entityPalette';
import type { ToolManager } from '../../tools/toolManager';
import { wireDragReorder, wireGroupEndDrop, type DragMeta } from './rowDragReorder';

export interface UnifiedTreeOptions {
    state: EditorWorkingState;
    stack: CommandStack;
    selection: SelectionStore;
    camera: EditorCamera;
    persisted: EditorStatePersisted;
    tools: ToolManager;
    onHiddenChange: () => void;
    onPersist: () => void;
    onActiveLayerChange: () => void;
    onFloorChange: () => void;
    getErrorLayerIds?: () => Set<string>;
}

export interface UnifiedTreeHandle {
    refresh: () => void;
    refreshFloors: () => void;
    refreshLayers: () => void;
    refreshPalettes: () => void;
    beginRename: (guid: string) => void;
}

const PALETTE_OBJECT_SECTION_ID = 'palette-objects';
const PALETTE_ENTITY_SECTION_ID = 'palette-entities';

/** Mount the unified tree. Returns a handle with refresh fns. */
export function mountUnifiedTree(
    container: HTMLElement,
    opts: UnifiedTreeOptions,
): UnifiedTreeHandle {
    container.innerHTML = '';
    container.classList.add('editor-unified-tree');

    let filter = '';
    const renameCallbacks = new Map<string, () => void>();

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search items...';
    search.className = 'editor-tree-search';
    container.appendChild(search);

    const scroll = document.createElement('div');
    scroll.className = 'editor-tree-scroll';
    container.appendChild(scroll);

    const floorHost = document.createElement('div');
    floorHost.className = 'editor-tree-floor';
    scroll.appendChild(floorHost);

    const layersSectionHost = document.createElement('div');
    scroll.appendChild(layersSectionHost);

    const itemSectionHosts = new Map<string, HTMLElement>();
    for (const def of ITEM_SECTIONS) {
        const host = document.createElement('div');
        host.dataset.sectionId = def.id;
        scroll.appendChild(host);
        itemSectionHosts.set(def.id, host);
    }

    const palettesHost = document.createElement('div');
    palettesHost.className = 'editor-tree-palettes';
    scroll.appendChild(palettesHost);

    const refreshFloors = mountFloorSelector(floorHost, {
        state: opts.state,
        camera: opts.camera,
        persisted: opts.persisted,
        selection: opts.selection,
        onFloorChange: () => {
            opts.onFloorChange();
            refreshLayers();
            refreshItems();
        },
        onPersist: opts.onPersist,
    });

    const renderLayersSection = (): void => {
        const section = renderSection(layersSectionHost, {
            id: 'layers',
            title: 'Layers',
            persisted: opts.persisted,
            filtered: filter !== '',
            count: opts.state.map.layers.filter((l) => l.floorId === opts.state.activeFloorId).length,
            defaultCollapsed: false,
            onToggle: () => {
                opts.onPersist();
                renderLayersSection();
            },
            action: {
                label: '+',
                title: 'New layer',
                onClick: addLayer,
            },
        });
        if (section.bodyVisible) mountLayerList(section.body, layerListOpts);
    };
    const layerListOpts = {
        state: opts.state,
        stack: opts.stack,
        onActiveLayerChange: () => {
            opts.onActiveLayerChange();
            refreshItems();
        },
        onPersist: opts.onPersist,
        getErrorLayerIds: opts.getErrorLayerIds,
        renameCallbacks,
    };
    const refreshLayers = (): void => renderLayersSection();

    const addLayer = (): void => {
        const floorId = opts.state.activeFloorId;
        if (!floorId) return;
        const label = nextLayerLabel(opts.state, floorId);
        const result = buildAddLayerCommand(opts.state, floorId, label);
        if (!result) return;
        opts.stack.dispatch(result.command);
        opts.state.activeLayerId = result.layerId;
        opts.onActiveLayerChange();
        renderLayersSection();
        refreshItems();
        queueMicrotask(() => {
            const cb = renameCallbacks.get(result.layerId);
            if (cb) cb();
        });
    };

    const refreshItems = (): void => {
        for (const def of ITEM_SECTIONS) {
            const host = itemSectionHosts.get(def.id);
            if (!host) continue;
            host.innerHTML = '';
            const rows = collectSectionRows(opts.state, def, filter);
            if (filter && rows.length === 0) continue;
            const flagState = collectSectionFlagState(opts.state, def);
            const section = renderSection(host, {
                id: def.id,
                title: def.title,
                persisted: opts.persisted,
                filtered: filter !== '',
                count: rows.length,
                defaultCollapsed: false,
                onToggle: () => {
                    opts.onPersist();
                    refreshItems();
                },
                flags: {
                    state: flagState,
                    onToggle: (flag, nextValue) => dispatchSectionFlag(def, flag, nextValue),
                },
            });
            if (!section.bodyVisible) continue;
            for (const row of rows) {
                section.body.appendChild(buildRow(row, opts, filter, renameCallbacks, def));
            }
        }
    };

    const dispatchSectionFlag = (
        def: SectionDef,
        flag: SectionFlag,
        value: boolean,
    ): void => {
        for (const kind of def.kinds) {
            const scope = scopeForSection(def, opts.state);
            const cmd = buildSetSectionFlagCommand(opts.state, kind, scope, flag, value);
            if (cmd) opts.stack.dispatch(cmd);
        }
        opts.onHiddenChange();
    };

    const renderPalettes = (): void => {
        palettesHost.innerHTML = '';
        const objectSection = renderSection(palettesHost, {
            id: PALETTE_OBJECT_SECTION_ID,
            title: 'Object Palette',
            persisted: opts.persisted,
            filtered: false,
            count: null,
            defaultCollapsed: true,
            onToggle: () => {
                opts.onPersist();
                renderPalettes();
            },
        });
        if (objectSection.bodyVisible) {
            mountObjectPalette(objectSection.body, {
                state: opts.state,
                recents: opts.persisted.paletteRecents,
                onPick: (defId) => opts.tools.activate('object', { defId }),
            });
        }

        const entitySection = renderSection(palettesHost, {
            id: PALETTE_ENTITY_SECTION_ID,
            title: 'Entity Palette',
            persisted: opts.persisted,
            filtered: false,
            count: null,
            defaultCollapsed: true,
            onToggle: () => {
                opts.onPersist();
                renderPalettes();
            },
        });
        if (entitySection.bodyVisible) {
            mountEntityPalette(entitySection.body, {
                state: opts.state,
                recents: opts.persisted.paletteRecents,
                onPick: (defId) => opts.tools.activate('entity', { defId }),
            });
        }
    };

    search.addEventListener('input', () => {
        filter = search.value.trim();
        refreshItems();
    });

    renderLayersSection();
    refreshItems();
    renderPalettes();

    opts.selection.subscribe(refreshItems);

    return {
        refresh: () => {
            refreshFloors();
            renderLayersSection();
            refreshItems();
        },
        refreshFloors,
        refreshLayers: renderLayersSection,
        refreshPalettes: renderPalettes,
        beginRename: (guid: string) => {
            const cb = renameCallbacks.get(guid);
            if (cb) cb();
        },
    };
}

interface SectionAction {
    label: string;
    title: string;
    onClick: () => void;
}

interface SectionFlagsOption {
    state: { anyVisible: boolean; allHidden: boolean; anyUnlocked: boolean; allLocked: boolean; empty: boolean };
    onToggle: (flag: SectionFlag, nextValue: boolean) => void;
}

interface SectionOptions {
    id: string;
    title: string;
    persisted: EditorStatePersisted;
    filtered: boolean;
    count: number | null;
    defaultCollapsed: boolean;
    onToggle: () => void;
    action?: SectionAction;
    flags?: SectionFlagsOption;
}

interface SectionRender {
    body: HTMLElement;
    bodyVisible: boolean;
}

function renderSection(host: HTMLElement, opts: SectionOptions): SectionRender {
    host.innerHTML = '';
    host.classList.add('editor-tree-section');

    const resolvedCollapsed = resolveSectionCollapsed(
        opts.persisted.treeCollapse,
        opts.id,
        opts.defaultCollapsed,
        false,
    );
    const effectivelyCollapsed = resolveSectionCollapsed(
        opts.persisted.treeCollapse,
        opts.id,
        opts.defaultCollapsed,
        opts.filtered,
    );

    const header = document.createElement('div');
    header.className = 'editor-tree-section-header';
    if (effectivelyCollapsed) header.classList.add('collapsed');

    const chevron = document.createElement('span');
    chevron.className = 'editor-tree-section-chevron';
    chevron.textContent = effectivelyCollapsed ? '>' : 'v';
    header.appendChild(chevron);

    const title = document.createElement('span');
    title.className = 'editor-tree-section-title';
    title.textContent = opts.title;
    header.appendChild(title);

    if (opts.count !== null) {
        const badge = document.createElement('span');
        badge.className = 'editor-tree-section-count';
        badge.textContent = `(${opts.count})`;
        header.appendChild(badge);
    }

    if (opts.flags) {
        const { state: flagState, onToggle } = opts.flags;
        const eye = document.createElement('button');
        eye.type = 'button';
        eye.className = 'editor-tree-section-eye';
        eye.disabled = flagState.empty;
        const hiddenAll = flagState.empty ? false : !flagState.anyVisible;
        eye.textContent = hiddenAll ? '-' : 'O';
        eye.title = hiddenAll ? 'Show all' : 'Hide all';
        eye.addEventListener('click', (e) => {
            e.stopPropagation();
            if (flagState.empty) return;
            onToggle('hidden', flagState.anyVisible);
        });
        header.appendChild(eye);

        const lock = document.createElement('button');
        lock.type = 'button';
        lock.className = 'editor-tree-section-lock';
        lock.disabled = flagState.empty;
        const lockedAll = flagState.empty ? false : !flagState.anyUnlocked;
        lock.textContent = lockedAll ? 'L' : 'U';
        lock.title = lockedAll ? 'Unlock all' : 'Lock all';
        lock.addEventListener('click', (e) => {
            e.stopPropagation();
            if (flagState.empty) return;
            onToggle('locked', flagState.anyUnlocked);
        });
        header.appendChild(lock);
    }

    if (opts.action) {
        const action = opts.action;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'editor-tree-section-action';
        btn.textContent = action.label;
        btn.title = action.title;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            action.onClick();
        });
        header.appendChild(btn);
    }

    header.addEventListener('click', () => {
        opts.persisted.treeCollapse[opts.id] = !resolvedCollapsed;
        opts.onToggle();
    });

    host.appendChild(header);

    const body = document.createElement('div');
    body.className = 'editor-tree-section-body';
    host.appendChild(body);

    return { body, bodyVisible: !effectivelyCollapsed };
}

function buildRow(
    entry: RowEntry,
    opts: UnifiedTreeOptions,
    filter: string,
    renameCallbacks: Map<string, () => void>,
    def: SectionDef,
): HTMLElement {
    if (entry.kind === 'group') {
        return buildGroupRow(entry, opts, filter);
    }

    const ref = entry.ref!;
    const rawItem = findRawItem(opts.state, ref.guid);
    const itemLocked = rawItem?.locked === true;
    const itemHidden = rawItem?.hidden === true || opts.state.editorHiddenGUIDs.has(ref.guid);

    const handle = buildItemListRow({
        item: ref,
        isSelected: opts.selection.has(ref.guid),
        isHidden: itemHidden,
        isLocked: itemLocked,
        filter,
        onSelect: (e) => {
            opts.selection.select(ref.guid, e.shiftKey);
            panToIfOffscreen(opts.state, opts.camera, ref.guid);
        },
        onToggleVisibility: () => {
            const cmd = buildSetItemVisibilityCommand(opts.state, ref.guid, !itemHidden);
            if (cmd) opts.stack.dispatch(cmd);
            else opts.onHiddenChange();
        },
        onToggleLock: () => {
            const cmd = buildSetItemLockCommand(opts.state, ref.guid, !itemLocked);
            if (cmd) opts.stack.dispatch(cmd);
        },
        onRename: (next) => {
            const cmd = buildRenameItemCommand(opts.state, ref.guid, next);
            if (cmd) opts.stack.dispatch(cmd);
        },
    });
    handle.el.style.paddingLeft = `${entry.depth * 12 + 6}px`;
    renameCallbacks.set(ref.guid, handle.beginRename);

    const meta: DragMeta = {
        guid: ref.guid,
        container: containerForItem(opts.state, ref.guid, def),
        node: 'item',
    };
    wireDragReorder(handle.el, meta, {
        onDrop: (src, position) => {
            const cmd = buildDragReorderCommand(opts.state, src.guid, ref.guid, position);
            if (cmd) opts.stack.dispatch(cmd);
        },
    });
    return handle.el;
}

function buildGroupRow(
    entry: RowEntry,
    opts: UnifiedTreeOptions,
    filter: string,
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'editor-item-row editor-group-row';
    row.style.paddingLeft = `${entry.depth * 12 + 6}px`;
    row.dataset.guid = entry.groupId ?? '';
    const icon = document.createElement('span');
    icon.className = 'editor-item-icon editor-group-icon';
    icon.textContent = 'G';
    row.appendChild(icon);
    const name = document.createElement('span');
    name.className = 'editor-item-name';
    renderHighlightedText(name, entry.groupLabel ?? '', filter);
    row.appendChild(name);

    const groupId = entry.groupId;
    if (!groupId) return row;
    const group = opts.state.groups.get(groupId);
    if (!group) return row;
    const isNested = group.parentGroupId !== null;

    if (isNested) {
        const meta: DragMeta = {
            guid: groupId,
            container: `group:${group.parentGroupId!}`,
            node: 'group',
        };
        wireDragReorder(row, meta, {
            onDrop: (src, position) => {
                const cmd = buildDragReorderCommand(opts.state, src.guid, groupId, position);
                if (cmd) opts.stack.dispatch(cmd);
            },
        });
    } else {
        wireGroupEndDrop(row, groupId, {
            onDropOntoEmpty: (src) => {
                const cmd = buildMoveMemberCommand(opts.state, src.guid, {
                    kind: 'group-end',
                    groupId,
                });
                if (cmd) opts.stack.dispatch(cmd);
            },
        });
    }

    return row;
}

function containerForItem(
    state: EditorWorkingState,
    guid: string,
    def: SectionDef,
): string {
    const parent = parentGroupIdOf(state, guid);
    if (parent) return `group:${parent}`;
    if (def.global) return 'navHints';
    const ref = state.byGUID.get(guid);
    if (def.floorScoped) return `zones:${ref?.floorId ?? ''}`;
    const kind = ref?.kind ?? def.kinds[0];
    return `array:${ref?.layerId ?? state.activeLayerId}:${kind}`;
}

function parentGroupIdOf(state: EditorWorkingState, id: string): string | null {
    for (const g of state.groups.values()) {
        if (g.memberIds.includes(id)) return g.id;
    }
    return null;
}

function scopeForSection(def: SectionDef, state: EditorWorkingState): SectionScope {
    if (def.global) return {};
    if (def.floorScoped) return { floorId: state.activeFloorId };
    return { layerId: state.activeLayerId };
}

function nextLayerLabel(state: EditorWorkingState, floorId: string): string {
    const existing = new Set<string>(
        state.map.layers.filter((l) => l.floorId === floorId).map((l) => l.label),
    );
    let n = 1;
    while (existing.has(`New Layer ${n}`)) n += 1;
    return `New Layer ${n}`;
}

interface RawItem {
    hidden?: boolean;
    locked?: boolean;
}

function findRawItem(state: EditorWorkingState, guid: string): RawItem | null {
    for (const layer of state.map.layers) {
        for (const w of layer.walls) if (w.id === guid) return w;
        for (const o of layer.objects) if (o.id === guid) return o;
        for (const e of layer.entities) if (e.id === guid) return e;
        for (const d of layer.decals) if (d.id === guid) return d;
        for (const l of layer.lights) if (l.id === guid) return l;
    }
    for (const z of state.map.zones) if (z.id === guid) return z;
    for (const n of state.map.navHints) if (n.id === guid) return n;
    return null;
}

function panToIfOffscreen(
    state: EditorWorkingState,
    camera: EditorCamera,
    guid: string,
): void {
    const aabb = boundsOfGUID(state, guid);
    if (aabb.width === 0 && aabb.height === 0) return;
    const vp = camera.getViewportSize();
    const left = camera.x;
    const top = camera.y;
    const right = left + vp.width / camera.zoom;
    const bottom = top + vp.height / camera.zoom;
    const cx = aabb.x + aabb.width / 2;
    const cy = aabb.y + aabb.height / 2;
    if (cx < left || cx > right || cy < top || cy > bottom) {
        camera.centerOn(cx, cy);
    }
}
