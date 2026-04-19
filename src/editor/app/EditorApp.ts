/**
 * Editor bootstrap and wiring.
 *
 * Owns the lifetime of every Phase 1-4 subsystem: working state, command
 * stack, dirty tracker, file service, persistence, Pixi viewport, grid
 * renderer, snap service, menu bar, keyboard dispatcher, auto-save, editor
 * map renderer, selection store, drag overlay/controller, tool manager,
 * selection overlay, error overlay, left/right/bottom panels, context menu
 * actions, compile check, play-test.
 *
 * Part of the editor layer.
 */

import { validateMap } from '@orchestration/bootstrap/MapValidator';
import type { MapData, Vec2 } from '@shared/map/MapData';

import { CommandStack } from '../commands/CommandStack';
import { deserializeCommand } from '../commands/deserialize';
import { GridRenderer } from '../grid/GridRenderer';
import { MapBoundsOverlay } from '../viewport/mapBoundsOverlay';
import { KeyboardDispatcher } from '../input/KeyboardDispatcher';
import { installPhase1Shortcuts, installPhase2Shortcuts, installPhase4Shortcuts, installPhase5Shortcuts } from '../input/shortcutMap';
import { mountLeftPanel, type LeftPanelHandle } from '../panels/LeftPanel';
import { type MenuBarActions, type MenuBarHandle, mountMenuBar } from '../panels/MenuBar';
import { mountRightPanel, type RightPanelHandle } from '../panels/RightPanel';
import { TitleBar } from '../panels/titleBar';
import { AutoSaveTimer, readAutoSave } from '../persistence/autoSave';
import { contentHash } from '../persistence/contentHash';
import {
    copyEditorState,
    defaultEditorState,
    type EditorStatePersisted,
    loadEditorState,
    saveEditorState,
} from '../persistence/editorStatePersistence';
import type { FileService } from '../persistence/FileService';
import { FileSystemAccessService } from '../persistence/FileSystemAccessService';
import { UNTITLED_KEY, filePathKey } from '../persistence/filePathKey';
import { migrateToLatest } from '../migrations/migrationRegistry';
import '../migrations/v1to1_5';
import { SnapIndicator } from '../snap/SnapIndicator';
import { SnapService } from '../snap/SnapService';
import { createDefaultMapData } from '../state/defaultMap';
import { DirtyTracker } from '../state/dirtyTracker';
import { createWorkingState, replaceFromSnapshot, type EditorWorkingState } from '../state/EditorWorkingState';
import { snapshotJson } from '../state/serializeToMapData';
import { EditorCamera } from '../viewport/EditorCamera';
import { initEditorPixi } from '../viewport/EditorPixiApp';
import { PanInput } from '../viewport/panInput';
import { WheelZoom } from '../viewport/wheelZoom';
import { ZoomIndicator } from '../viewport/zoomIndicator';

import { SelectionStore } from '../selection/selectionStore';
import { GroupEnterState } from '../selection/groupEnterState';
import { EditorMapRenderer } from '../rendering/editorMapRenderer';
import { SelectionOverlay } from '../gizmos/selectionOverlay';
import { DragOverlay } from '../drag/dragOverlay';
import { DragController } from '../drag/dragController';
import { ToolManager } from '../tools/toolManager';
import { SelectTool } from '../tools/selectTool';
import { WallTool } from '../tools/wallTool';
import { ZoneTool } from '../tools/zoneTool';
import { LightTool } from '../tools/lightTool';
import { NavHintTool } from '../tools/navHintTool';
import { ObjectTool } from '../tools/objectTool';
import { EntityTool } from '../tools/entityTool';
import { ToolSettingsStore } from '../tools/toolSettings';
import { mountToolOptionsBar } from '../panels/ToolOptionsBar';
import { openQuickPalette, closeQuickPalette } from '../palette/quickPalettePopup';
import { openContextMenu, closeContextMenu } from '../contextMenu/contextMenu';
import { itemMenu, emptyMenu, type EditorActions } from '../contextMenu/contextMenuActions';
import { buildCutItemsCommand } from '../commands/cutItemsCommand';
import { buildPasteItemsCommand } from '../commands/pasteItemsCommand';
import { buildDuplicateItemsCommand } from '../commands/duplicateItemsCommand';
import { buildDeleteItemsCommand } from '../commands/deleteItemsCommand';
import { buildMoveToLayerCommand } from '../commands/moveToLayerCommand';
import { buildSetLayerLockCommand } from '../commands/setLayerLockCommand';
import { buildCreateGroupCommand, buildDissolveGroupCommand } from '../commands/groupCommands';
import { findGroupForExactSelection } from '../groups/groupQueries';
import { hydrateGroups, serializeGroups } from '../groups/hydrateGroups';
import { copyToClipboard } from '../clipboard/clipboard';

import { runCompile, errorLayerIds, type CompileResult, type CompileError } from '../compile/mapCompiler';
import { mountErrorPanel, type ErrorPanelHandle } from '../panels/ErrorPanel';
import { ErrorOverlay } from '../viewport/errorOverlay';
import { enterPlayTest } from '../playtest/editorPlayTest';
import { openMapPropertiesDialog } from '../panels/dialogs/mapPropertiesDialog';
import { openSignalRegistryDialog } from '../panels/dialogs/signalRegistryDialog';
import { openFloorManagementDialog } from '../panels/dialogs/floorManagementDialog';

interface EditorAppDeps {
    root: HTMLElement;
    topbar: HTMLElement;
    toolOptions: HTMLElement;
    left: HTMLElement;
    right: HTMLElement;
    viewport: HTMLElement;
    bottom: HTMLElement;
}

export class EditorApp {
    private state!: EditorWorkingState;
    private stack!: CommandStack;
    private dirty!: DirtyTracker;
    private fileService: FileService = new FileSystemAccessService();
    private camera = new EditorCamera();
    private snap = new SnapService();
    private grid!: GridRenderer;
    private titleBar!: TitleBar;
    private menuBarHandle!: MenuBarHandle;
    private autoSave!: AutoSaveTimer;
    private currentHandle: FileSystemFileHandle | null = null;
    private currentFilePath: string = UNTITLED_KEY;
    private persistedState: EditorStatePersisted = defaultEditorState();
    private dispatcher = new KeyboardDispatcher();

    private selection = new SelectionStore();
    private groupEnter = new GroupEnterState();
    private dragOverlay = new DragOverlay();
    private renderer!: EditorMapRenderer;
    /** Holds subscriptions to selection/camera/stack; kept alive via field reference. */
    private selectionOverlay!: SelectionOverlay;
    private drag!: DragController;
    private tools = new ToolManager();
    private toolSettings = new ToolSettingsStore();
    private leftPanel!: LeftPanelHandle;
    private rightPanel!: RightPanelHandle;
    private errorPanel!: ErrorPanelHandle;
    private errorOverlay!: ErrorOverlay;
    private viewportEl!: HTMLElement;
    private canvasEl!: HTMLCanvasElement;
    private cursorWorld: Vec2 = { x: 0, y: 0 };
    private cursorScreen: Vec2 = { x: 0, y: 0 };

    private compileResult: CompileResult | null = null;

    constructor(private readonly deps: EditorAppDeps) {}

    async init(): Promise<void> {
        const initialMap = consumeReturnMap() ?? createDefaultMapData();
        this.state = createWorkingState(initialMap);
        this.stack = new CommandStack(this.state);
        this.dirty = new DirtyTracker(this.stack);

        const actions = this.buildActions();

        const handle = mountMenuBar(this.deps.topbar, actions);
        this.menuBarHandle = handle;
        this.titleBar = new TitleBar(handle.titleEl);
        this.updateTitle();

        mountToolOptionsBar(this.deps.toolOptions, this.tools, this.toolSettings);

        const pixi = await initEditorPixi(this.deps.viewport, this.camera);
        this.viewportEl = this.deps.viewport;
        this.canvasEl = pixi.canvas;

        this.grid = new GridRenderer(pixi.scene.backgroundLayer, this.camera, this.snap);
        const boundsOverlay = new MapBoundsOverlay(pixi.scene.backgroundLayer, this.state, this.camera);
        new SnapIndicator(pixi.scene.overlayLayer, this.snap, this.camera);

        new PanInput(this.deps.viewport, this.camera);
        new WheelZoom(this.deps.viewport, this.camera);
        new ZoomIndicator(this.deps.viewport, this.camera, this.snap, () => this.buildPhase2ShortcutActions().zoomReset());

        pixi.app.ticker.add(() => {
            this.grid.update();
            boundsOverlay.update();
        });

        this.renderer = new EditorMapRenderer(this.state, pixi.scene.sublayers, this.dragOverlay);
        this.selectionOverlay = new SelectionOverlay(
            this.state,
            this.selection,
            this.camera,
            this.stack,
            pixi.scene.overlayLayer,
        );
        this.drag = new DragController(this.state, this.dragOverlay, this.stack, this.canvasEl, this.snap);
        void this.selectionOverlay;

        this.errorOverlay = new ErrorOverlay(pixi.scene.overlayLayer);

        this.registerTools(pixi.scene.overlayLayer);
        this.tools.setCursorTarget(this.canvasEl);
        this.tools.activate('select');

        this.errorPanel = mountErrorPanel(this.deps.bottom, (error) => this.handleErrorRowClick(error));

        this.leftPanel = mountLeftPanel(this.deps.left, this.deps.root, {
            state: this.state,
            stack: this.stack,
            persisted: this.persistedState,
            selection: this.selection,
            camera: this.camera,
            tools: this.tools,
            onPersist: () => void this.persistCurrent(),
            onActiveLayerChange: () => this.renderer.rebuild(),
            onFloorChange: () => {
                this.groupEnter.exit();
                this.renderer.rebuild();
                this.rebuildErrorOverlay();
            },
            onHiddenChange: () => this.renderer.rebuild(),
            getErrorLayerIds: () => (this.compileResult ? errorLayerIds(this.compileResult) : new Set()),
        });

        this.rightPanel = mountRightPanel(this.deps.right, this.deps.root, {
            state: this.state,
            stack: this.stack,
            selection: this.selection,
        });

        installPhase1Shortcuts(this.dispatcher, actions);
        installPhase2Shortcuts(this.dispatcher, this.buildPhase2ShortcutActions());
        installPhase4Shortcuts(this.dispatcher, {
            compile: () => this.runCompile(),
            playTest: () => this.runPlayTest(),
        });
        installPhase5Shortcuts(this.dispatcher, {
            groupSelection: () => this.runGroupSelection(),
            dissolveGroup: () => this.runDissolveGroup(),
        });

        this.wirePointerEvents();

        this.stack.subscribe(() => this.updateTitle());
        this.dirty.subscribe(() => this.updateTitle());

        this.wireStackListeners();

        this.autoSave = new AutoSaveTimer({
            getFilePathKey: () => this.currentFilePath,
            isDirty: () => this.dirty.isDirty(),
            snapshotMapJson: () => snapshotJson(this.state),
        });
        this.autoSave.start();

        this.camera.centerOn(this.state.map.bounds.width / 2, this.state.map.bounds.height / 2);

        await this.restoreEditorState();
        this.renderer.rebuild();

        this.exposeDebug();
    }

    private buildActions(): MenuBarActions {
        return {
            newMap: () => void this.newMap(),
            open: () => void this.open(),
            save: () => void this.save(),
            saveAs: () => void this.saveAs(),
            undo: () => this.stack.undo(),
            redo: () => this.stack.redo(),
            cut: () => this.runCut(),
            copy: () => this.runCopy(),
            paste: () => this.runPaste(this.cursorWorld),
            duplicate: () => this.runDuplicate(),
            deleteSelection: () => this.runDelete(),
            selectAll: () => this.runSelectAll(),
            groupSelection: () => this.runGroupSelection(),
            dissolveGroup: () => this.runDissolveGroup(),
            toggleGrid: () => this.grid.setVisible(!this.grid.isVisible()),
            toggleSnap: () => {
                this.snap.toggle();
                void this.persistCurrent();
            },
            zoomIn: () => this.buildPhase2ShortcutActions().zoomIn(),
            zoomOut: () => this.buildPhase2ShortcutActions().zoomOut(),
            zoomFit: () => this.buildPhase2ShortcutActions().zoomFit(),
            zoomReset: () => this.buildPhase2ShortcutActions().zoomReset(),
            collisionOverlay: () => { /* stub -- post-Phase-4 */ },
            zoneOverlay: () => { /* stub -- post-Phase-4 */ },
            activateTool: (id) => this.tools.activate(id),
            mapProperties: () => openMapPropertiesDialog(this.state, (cmd) => this.stack.dispatch(cmd)),
            floorManagement: () => openFloorManagementDialog(this.state, (cmd) => this.stack.dispatch(cmd)),
            signalRegistry: () => openSignalRegistryDialog(this.state, (cmd) => this.stack.dispatch(cmd)),
            compile: () => this.runCompile(),
            playTest: () => this.runPlayTest(),
            toggleErrorPanel: () => this.errorPanel.toggle(),
        };
    }

    private buildPhase2ShortcutActions() {
        return {
            activateTool: (toolId: string) => this.tools.activate(toolId),
            cancel: () => this.cancelGesture(),
            cut: () => this.runCut(),
            copy: () => this.runCopy(),
            paste: () => this.runPaste(this.cursorWorld),
            duplicate: () => this.runDuplicate(),
            deleteSelection: () => this.runDelete(),
            selectAll: () => this.runSelectAll(),
            openQuickObject: () =>
                openQuickPalette({
                    state: this.state,
                    recents: this.persistedState.paletteRecents,
                    kind: 'object',
                    screenX: this.cursorScreen.x,
                    screenY: this.cursorScreen.y,
                    onPick: (defId) => this.tools.activate('object', { defId }),
                }),
            openQuickEntity: () =>
                openQuickPalette({
                    state: this.state,
                    recents: this.persistedState.paletteRecents,
                    kind: 'entity',
                    screenX: this.cursorScreen.x,
                    screenY: this.cursorScreen.y,
                    onPick: (defId) => this.tools.activate('entity', { defId }),
                }),
            zoomIn: () => this.camera.zoomAt(
                this.deps.viewport.clientWidth / 2,
                this.deps.viewport.clientHeight / 2,
                2,
            ),
            zoomOut: () => this.camera.zoomAt(
                this.deps.viewport.clientWidth / 2,
                this.deps.viewport.clientHeight / 2,
                0.5,
            ),
            zoomReset: () => {
                const cx = this.state.map.bounds.width / 2;
                const cy = this.state.map.bounds.height / 2;
                this.camera.restore({ x: cx - this.deps.viewport.clientWidth / 2, y: cy - this.deps.viewport.clientHeight / 2, zoom: 1 });
            },
            zoomFit: () => {
                const { width, height } = this.state.map.bounds;
                const vw = this.deps.viewport.clientWidth;
                const vh = this.deps.viewport.clientHeight;
                const zoom = Math.min(vw / width, vh / height) * 0.9;
                const cx = width / 2 - vw / 2 / zoom;
                const cy = height / 2 - vh / 2 / zoom;
                this.camera.restore({ x: cx, y: cy, zoom });
            },
        };
    }

    private buildEditorActions(): EditorActions {
        return {
            cut: () => this.runCut(),
            copy: () => this.runCopy(),
            paste: (target) => this.runPaste(target),
            duplicate: () => this.runDuplicate(),
            deleteSelection: () => this.runDelete(),
            selectAll: () => this.runSelectAll(),
            moveToLayer: (layerId) => this.runMoveToLayer(layerId),
            toggleLayerLock: () => this.runToggleLayerLock(),
            openProperties: () => this.leftPanel.setTab('layers'),
        };
    }

    private registerTools(overlay: import('pixi.js').Container): void {
        this.tools.register(
            new SelectTool({
                state: this.state,
                selection: this.selection,
                groupEnter: this.groupEnter,
                renderer: this.renderer,
                drag: this.drag,
                stack: this.stack,
                camera: this.camera,
                overlayParent: overlay,
                canvasEl: this.canvasEl,
            }),
        );
        const spriteCache = this.renderer.getSpriteCache();
        this.tools.register(
            new WallTool({
                state: this.state,
                stack: this.stack,
                selection: this.selection,
                snap: this.snap,
                camera: this.camera,
                overlayParent: overlay,
                settings: this.toolSettings,
                toolManager: this.tools,
            }),
        );
        this.tools.register(
            new ZoneTool({
                state: this.state,
                stack: this.stack,
                selection: this.selection,
                snap: this.snap,
                overlayParent: overlay,
                settings: this.toolSettings,
                toolManager: this.tools,
            }),
        );
        this.tools.register(
            new LightTool({
                state: this.state,
                stack: this.stack,
                selection: this.selection,
                snap: this.snap,
                overlayParent: overlay,
                toolManager: this.tools,
            }),
        );
        this.tools.register(
            new NavHintTool({
                state: this.state,
                stack: this.stack,
                selection: this.selection,
                snap: this.snap,
                overlayParent: overlay,
                settings: this.toolSettings,
                toolManager: this.tools,
            }),
        );
        this.tools.register(
            new ObjectTool({
                state: this.state,
                stack: this.stack,
                selection: this.selection,
                snap: this.snap,
                overlayParent: overlay,
                spriteCache,
                toolManager: this.tools,
                onRequestPalette: () =>
                    openQuickPalette({
                        state: this.state,
                        recents: this.persistedState.paletteRecents,
                        kind: 'object',
                        screenX: this.cursorScreen.x,
                        screenY: this.cursorScreen.y,
                        onPick: (defId) => this.tools.activate('object', { defId }),
                    }),
            }),
        );
        this.tools.register(
            new EntityTool({
                state: this.state,
                stack: this.stack,
                selection: this.selection,
                snap: this.snap,
                overlayParent: overlay,
                spriteCache,
                toolManager: this.tools,
                onRequestPalette: () =>
                    openQuickPalette({
                        state: this.state,
                        recents: this.persistedState.paletteRecents,
                        kind: 'entity',
                        screenX: this.cursorScreen.x,
                        screenY: this.cursorScreen.y,
                        onPick: (defId) => this.tools.activate('entity', { defId }),
                    }),
            }),
        );
    }

    private wirePointerEvents(): void {
        const target = this.canvasEl;

        const toToolEvent = (e: PointerEvent) => {
            const rect = target.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const w = this.camera.screenToWorld(sx, sy);
            return { native: e, worldX: w.x, worldY: w.y, screenX: sx, screenY: sy };
        };

        target.addEventListener('pointerdown', (e) => {
            if (e.button === 2) return;
            this.tools.onPointerDown(toToolEvent(e));
        });
        target.addEventListener('pointermove', (e) => {
            const evt = toToolEvent(e);
            this.cursorWorld = { x: evt.worldX, y: evt.worldY };
            this.cursorScreen = { x: evt.screenX, y: evt.screenY };
            this.tools.onPointerMove(evt);
        });
        target.addEventListener('pointerup', (e) => this.tools.onPointerUp(toToolEvent(e)));
        target.addEventListener('contextmenu', (e) => {
            const evt = toToolEvent(e as unknown as PointerEvent);
            this.tools.onContextMenu(evt);
            if (e.defaultPrevented) return;
            e.preventDefault();
            this.openContextAt(evt.screenX, evt.screenY, evt.worldX, evt.worldY);
        });

        window.addEventListener('keydown', (e) => {
            this.tools.onKeyDown({ native: e });
        });
    }

    private openContextAt(screenX: number, screenY: number, worldX: number, worldY: number): void {
        if (this.drag.isActive()) {
            this.drag.cancel();
            return;
        }
        const target = { x: worldX, y: worldY };
        const hit = this.renderer.hitTest(worldX, worldY);
        const actions = this.buildEditorActions();

        const rect = this.viewportEl.getBoundingClientRect();
        const docX = rect.left + screenX;
        const docY = rect.top + screenY;

        if (hit) {
            if (!this.selection.has(hit)) this.selection.select(hit);
            openContextMenu(itemMenu(this.state, this.selection, actions, target), docX, docY);
        } else {
            openContextMenu(emptyMenu(actions, target), docX, docY);
        }
    }

    private cancelGesture(): void {
        closeContextMenu();
        closeQuickPalette();
        if (this.drag.isActive()) {
            this.drag.cancel();
            return;
        }
        if (this.tools.activeToolId() !== 'select') {
            this.tools.activate('select');
        }
    }

    private runCut(): void {
        const guids = this.selection.selectedArray();
        const cmd = buildCutItemsCommand(this.state, guids);
        if (cmd) {
            this.stack.dispatch(cmd);
            this.selection.clear();
        }
    }

    private runCopy(): void {
        const guids = this.selection.selectedArray();
        if (guids.length === 0) return;
        copyToClipboard(this.state, guids);
    }

    private runPaste(target: Vec2): void {
        const snapped = this.snap.snapToGrid(target.x, target.y);
        const result = buildPasteItemsCommand(this.state, snapped);
        if (!result) return;
        this.stack.dispatch(result.command);
        this.selection.selectMany(result.newGuids);
    }

    private runDuplicate(): void {
        const guids = this.selection.selectedArray();
        const result = buildDuplicateItemsCommand(this.state, guids, this.snap);
        if (!result) return;
        this.stack.dispatch(result.command);
        this.selection.selectMany(result.newGuids);
    }

    private runDelete(): void {
        const guids = this.selection.selectedArray();
        const cmd = buildDeleteItemsCommand(this.state, guids);
        if (cmd) {
            this.stack.dispatch(cmd);
            this.selection.clear();
        }
    }

    private runSelectAll(): void {
        const layerId = this.state.activeLayerId;
        const ids = this.state.byLayer.get(layerId);
        if (!ids) return;
        this.selection.selectMany(ids);
    }

    private runGroupSelection(): void {
        const members = this.selection.selectedArray();
        const cmd = buildCreateGroupCommand(this.state, members);
        if (!cmd) return;
        this.stack.dispatch(cmd);
    }

    private runDissolveGroup(): void {
        const selected = this.selection.selectedArray();
        const group = findGroupForExactSelection(this.state, selected);
        if (!group) return;
        const cmd = buildDissolveGroupCommand(this.state, group.id);
        if (!cmd) return;
        this.stack.dispatch(cmd);
    }

    private runMoveToLayer(layerId: string): void {
        const guids = this.selection.selectedArray();
        const cmd = buildMoveToLayerCommand(this.state, guids, layerId);
        if (cmd) this.stack.dispatch(cmd);
    }

    private runToggleLayerLock(): void {
        const layerId = this.state.activeLayerId;
        const layer = this.state.map.layers.find((l) => l.id === layerId);
        if (!layer) return;
        const cmd = buildSetLayerLockCommand(this.state, layerId, !layer.locked);
        if (cmd) this.stack.dispatch(cmd);
    }

    /** Run compile check, update all error surfaces, persist result. */
    private runCompile(): void {
        const result = runCompile(this.state);
        this.applyCompileResult(result);
        this.errorPanel.show();
        void this.persistCurrent();
    }

    private applyCompileResult(result: CompileResult | null): void {
        this.compileResult = result;
        this.menuBarHandle.setCompileStatus(result);
        this.errorPanel.update(result, this.state);
        this.rebuildErrorOverlay();
        this.leftPanel.refreshLayers();
    }

    private rebuildErrorOverlay(): void {
        const errors = this.compileResult?.errors ?? [];
        this.errorOverlay.rebuild(errors, this.state, this.state.activeFloorId);
    }

    /**
     * Prune compile errors whose referenced GUIDs no longer exist. Called after
     * every command so deleting an erroring item removes its row from the
     * bottom panel + toolbar count. Modified-but-still-present items keep
     * their errors until the next compile per spec.
     */
    private refreshErrorsAfterMutation(): void {
        if (!this.compileResult) {
            this.rebuildErrorOverlay();
            return;
        }
        const filtered = this.compileResult.errors.filter(
            (e) => e.itemGUID === null || this.state.byGUID.has(e.itemGUID),
        );
        if (filtered.length === this.compileResult.errors.length) {
            this.rebuildErrorOverlay();
            return;
        }
        const pruned: CompileResult = {
            passed: filtered.length === 0,
            errors: filtered,
            timestamp: this.compileResult.timestamp,
        };
        this.applyCompileResult(pruned);
    }

    private handleErrorRowClick(error: CompileError): void {
        if (error.floorId && error.floorId !== this.state.activeFloorId) {
            this.state.activeFloorId = error.floorId;
            const firstLayer = this.state.map.layers.find((l) => l.floorId === error.floorId);
            if (firstLayer) this.state.activeLayerId = firstLayer.id;
            this.renderer.rebuild();
            this.rebuildErrorOverlay();
            this.leftPanel.refreshFloors();
            this.leftPanel.refreshLayers();
        }

        if (error.itemGUID && this.state.byGUID.has(error.itemGUID)) {
            this.selection.select(error.itemGUID);
            this.rightPanel.refresh();
        }

        if (error.worldPosition) {
            this.camera.centerOn(error.worldPosition.x, error.worldPosition.y);
        }

        this.leftPanel.refreshItems();
    }

    /** Compile-gated play-test entry. */
    private runPlayTest(): void {
        const result = runCompile(this.state);
        this.applyCompileResult(result);

        if (!result.passed) {
            this.errorPanel.show();
            return;
        }

        enterPlayTest(this.state);
    }

    private async newMap(): Promise<void> {
        if (this.dirty.isDirty()) {
            const ok = window.confirm('Discard unsaved changes?');
            if (!ok) return;
        }
        this.currentHandle = null;
        this.currentFilePath = UNTITLED_KEY;
        replaceFromSnapshot(this.state, JSON.stringify(createDefaultMapData()));
        this.stack.reset();
        this.persistedState = defaultEditorState();
        this.selection.clear();
        this.renderer.setState(this.state);
        this.camera.restore({ x: 0, y: 0, zoom: 1 });
        this.camera.centerOn(
            this.state.map.bounds.width / 2,
            this.state.map.bounds.height / 2,
        );
        this.applyCompileResult(null);
        this.refreshPanels();
        this.updateTitle();
    }

    private async open(): Promise<void> {
        try {
            const { handle, data, lastModified } = await this.fileService.open();
            const parsed = JSON.parse(data);
            const migrated = migrateToLatest(parsed);
            const errors = validateMap(migrated);
            if (errors.length) {
                console.warn('Map validation errors:', errors);
            }

            this.currentHandle = handle;
            this.currentFilePath = filePathKey(handle);

            const hash = await contentHash(migrated);
            const persisted = await loadEditorState(this.currentFilePath);

            const autosave = await readAutoSave(this.currentFilePath);
            if (autosave && autosave.timestamp > lastModified) {
                const restore = window.confirm(
                    'An auto-save exists that is newer than this file. Restore auto-save?',
                );
                if (restore) {
                    await this.applyMap(JSON.parse(autosave.mapJson) as MapData, hash, persisted);
                    this.updateTitle();
                    return;
                }
            }

            await this.applyMap(migrated, hash, persisted);
            this.updateTitle();
        } catch (err) {
            if (!isAbortError(err)) console.error('Open failed', err);
        }
    }

    private async applyMap(
        map: MapData,
        hash: string,
        persisted: EditorStatePersisted,
    ): Promise<void> {
        replaceFromSnapshot(this.state, JSON.stringify(map));
        this.stack.reset();
        this.persistedState = persisted;

        if (persisted.contentHash && persisted.contentHash !== hash) {
            console.warn('Undo history cleared (file changed externally)');
            persisted.undoStack = [];
            persisted.undoPointer = -1;
            persisted.selectedItemGUIDs = [];
        } else if (persisted.undoStack.length > 0) {
            try {
                const commands = persisted.undoStack.map(deserializeCommand);
                this.stack.restore(commands, persisted.undoPointer);
            } catch (err) {
                console.warn('Failed to restore undo stack', err);
                persisted.undoStack = [];
                persisted.undoPointer = -1;
            }
        }

        this.snap.setEnabled(persisted.snapEnabled);
        this.snap.setResolution(persisted.snapResolution);
        this.grid.setVisible(persisted.gridVisible);

        if (persisted.activeFloorId && this.state.map.floors.some((f) => f.id === persisted.activeFloorId)) {
            this.state.activeFloorId = persisted.activeFloorId;
        }
        if (persisted.activeLayerId && this.state.map.layers.some((l) => l.id === persisted.activeLayerId)) {
            this.state.activeLayerId = persisted.activeLayerId;
        }

        const cam = persisted.cameraPerFloor[this.state.activeFloorId];
        if (cam) {
            this.camera.restore(cam);
        } else {
            this.camera.restore({ x: 0, y: 0, zoom: 1 });
            this.camera.centerOn(map.bounds.width / 2, map.bounds.height / 2);
        }

        this.persistedState.contentHash = hash;
        hydrateGroups(this.state, persisted.groups);
        this.selection.clear();
        if (persisted.selectedItemGUIDs.length > 0) {
            const live = persisted.selectedItemGUIDs.filter((g) => this.state.byGUID.has(g));
            if (live.length > 0) this.selection.selectMany(live);
        }

        this.renderer.setState(this.state);
        this.applyCompileResult(persisted.lastCompileResult ?? null);
        this.refreshPanels();
    }

    private refreshPanels(): void {
        this.leftPanel.refreshFloors();
        this.leftPanel.refreshLayers();
        this.leftPanel.refreshItems();
        this.leftPanel.refreshPalettes();
        this.rightPanel.refresh();
    }

    private wireStackListeners(): void {
        this.stack.subscribe(() => this.updateTitle());
        this.stack.subscribe(() => {
            this.selection.pruneAgainst(this.state);
            this.renderer.rebuild();
            this.refreshErrorsAfterMutation();
            const top = this.stack.serialize();
            const last = top.stack[top.pointer];
            if (last?.isStructural && this.autoSave) this.autoSave.triggerImmediate();
        });
    }

    private async save(): Promise<void> {
        if (!this.currentHandle) {
            await this.saveAs();
            return;
        }
        try {
            const json = snapshotJson(this.state);
            await this.fileService.save(json, this.currentHandle);
            this.stack.markSaved();
            this.persistedState.contentHash = await contentHash(this.state.map);
            await this.persistCurrent();
            this.updateTitle();
        } catch (err) {
            console.error('Save failed', err);
        }
    }

    private async saveAs(): Promise<void> {
        try {
            const json = snapshotJson(this.state);
            const newHandle = await this.fileService.saveAs(json);
            const prevKey = this.currentFilePath;
            this.currentHandle = newHandle;
            this.currentFilePath = filePathKey(newHandle);
            if (prevKey !== this.currentFilePath) {
                await copyEditorState(prevKey, this.currentFilePath);
            }
            this.stack.markSaved();
            this.persistedState.contentHash = await contentHash(this.state.map);
            await this.persistCurrent();
            this.updateTitle();
        } catch (err) {
            if (!isAbortError(err)) console.error('Save As failed', err);
        }
    }

    private async persistCurrent(): Promise<void> {
        const serializedStack = this.stack.serialize();
        const snap = this.camera.snapshot();
        this.persistedState.activeFloorId = this.state.activeFloorId;
        this.persistedState.activeLayerId = this.state.activeLayerId;
        this.persistedState.cameraPerFloor[this.state.activeFloorId] = snap;
        this.persistedState.snapEnabled = this.snap.isEnabled();
        this.persistedState.snapResolution = this.snap.getResolution();
        this.persistedState.gridVisible = this.grid.isVisible();
        this.persistedState.undoStack = serializedStack.stack;
        this.persistedState.undoPointer = serializedStack.pointer;
        this.persistedState.selectedItemGUIDs = this.selection.selectedArray();
        this.persistedState.lastCompileResult = this.compileResult;
        this.persistedState.groups = serializeGroups(this.state);
        await saveEditorState(this.currentFilePath, this.persistedState);
    }

    private async restoreEditorState(): Promise<void> {
        this.persistedState = await loadEditorState(this.currentFilePath);
        this.snap.setEnabled(this.persistedState.snapEnabled);
        this.snap.setResolution(this.persistedState.snapResolution);
        this.grid.setVisible(this.persistedState.gridVisible);
        hydrateGroups(this.state, this.persistedState.groups);
        const cam = this.persistedState.cameraPerFloor[this.state.activeFloorId];
        if (cam) this.camera.restore(cam);
        if (this.persistedState.selectedItemGUIDs.length > 0) {
            const live = this.persistedState.selectedItemGUIDs.filter((g) =>
                this.state.byGUID.has(g),
            );
            if (live.length > 0) this.selection.selectMany(live);
        }
        this.applyCompileResult(this.persistedState.lastCompileResult ?? null);
        this.refreshPanels();
    }

    private updateTitle(): void {
        this.titleBar.update({
            name: this.state.map.meta.name || 'Untitled',
            dirty: this.dirty.isDirty(),
        });
    }

    private exposeDebug(): void {
        (window as unknown as { editor: unknown }).editor = {
            state: () => this.state,
            stack: () => this.stack,
            camera: () => this.camera,
            snap: () => this.snap,
            grid: () => this.grid,
            selection: () => this.selection,
            renderer: () => this.renderer,
            tools: () => this.tools,
            dispatch: (cmd: unknown) => this.stack.dispatch(cmd as never),
            persistedState: () => this.persistedState,
            filePath: () => this.currentFilePath,
            compile: () => this.runCompile(),
        };
    }
}

function isAbortError(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * If the user is returning from play-test, load the map they sent into the
 * game page. Single-consumption: the key is removed on read so a subsequent
 * editor reload starts clean.
 */
function consumeReturnMap(): MapData | null {
    const raw = sessionStorage.getItem('editor_return_map');
    if (!raw) return null;
    sessionStorage.removeItem('editor_return_map');
    try {
        return JSON.parse(raw) as MapData;
    } catch {
        return null;
    }
}
