/**
 * Top menu bar. All menus fully wired: File, Edit, View, Insert, Map.
 * Also hosts the compile status indicator (neutral / passed / failed).
 *
 * Part of the editor layer.
 */

import type { CompileResult } from '../compile/mapCompiler';

interface MenuItemSpec {
    label: string;
    shortcut?: string;
    action?: () => void;
}

interface MenuSpec {
    title: string;
    items: Array<MenuItemSpec | 'sep'>;
}

export interface MenuBarActions {
    newMap: () => void;
    open: () => void;
    save: () => void;
    saveAs: () => void;
    undo: () => void;
    redo: () => void;
    cut: () => void;
    copy: () => void;
    paste: () => void;
    duplicate: () => void;
    deleteSelection: () => void;
    selectAll: () => void;
    groupSelection: () => void;
    dissolveGroup: () => void;
    enterVertexEdit: () => void;
    toggleGrid: () => void;
    toggleSnap: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomFit: () => void;
    zoomReset: () => void;
    collisionOverlay: () => void;
    zoneOverlay: () => void;
    activateTool: (id: string) => void;
    mapProperties: () => void;
    floorManagement: () => void;
    signalRegistry: () => void;
    compile: () => void;
    playTest: () => void;
    toggleErrorPanel: () => void;
}

export interface MenuBarHandle {
    titleEl: HTMLElement;
    setCompileStatus(result: CompileResult | null): void;
}

/** Build the menu bar inside `container` and return a handle for updates. */
export function mountMenuBar(container: HTMLElement, actions: MenuBarActions): MenuBarHandle {
    container.innerHTML = '';

    const menus: MenuSpec[] = [
        {
            title: 'File',
            items: [
                { label: 'New Map', shortcut: 'Ctrl+N', action: actions.newMap },
                { label: 'Open...', shortcut: 'Ctrl+O', action: actions.open },
                'sep',
                { label: 'Save', shortcut: 'Ctrl+S', action: actions.save },
                { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: actions.saveAs },
            ],
        },
        {
            title: 'Edit',
            items: [
                { label: 'Undo', shortcut: 'Ctrl+Z', action: actions.undo },
                { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: actions.redo },
                'sep',
                { label: 'Cut', shortcut: 'Ctrl+X', action: actions.cut },
                { label: 'Copy', shortcut: 'Ctrl+C', action: actions.copy },
                { label: 'Paste', shortcut: 'Ctrl+V', action: actions.paste },
                { label: 'Duplicate', shortcut: 'Ctrl+D', action: actions.duplicate },
                'sep',
                { label: 'Delete', shortcut: 'Delete', action: actions.deleteSelection },
                { label: 'Select All', shortcut: 'Ctrl+A', action: actions.selectAll },
                'sep',
                { label: 'Group Selection', shortcut: 'Ctrl+Shift+G', action: actions.groupSelection },
                { label: 'Dissolve Group', shortcut: 'Ctrl+Shift+U', action: actions.dissolveGroup },
                'sep',
                { label: 'Enter Vertex Edit', shortcut: 'V', action: actions.enterVertexEdit },
            ],
        },
        {
            title: 'View',
            items: [
                { label: 'Toggle Grid', shortcut: 'G', action: actions.toggleGrid },
                { label: 'Toggle Snap', shortcut: 'Ctrl+G', action: actions.toggleSnap },
                'sep',
                { label: 'Zoom In', shortcut: 'Ctrl+=', action: actions.zoomIn },
                { label: 'Zoom Out', shortcut: 'Ctrl+-', action: actions.zoomOut },
                { label: 'Zoom to Fit', shortcut: 'Ctrl+0', action: actions.zoomFit },
                { label: 'Zoom 100%', shortcut: 'Ctrl+1', action: actions.zoomReset },
                'sep',
                { label: 'Collision Overlay', action: actions.collisionOverlay },
                { label: 'Zone Overlay', action: actions.zoneOverlay },
            ],
        },
        {
            title: 'Insert',
            items: [
                { label: 'Wall', shortcut: 'W', action: () => actions.activateTool('wall') },
                { label: 'Zone', shortcut: 'Z', action: () => actions.activateTool('zone') },
                { label: 'Object', shortcut: 'O', action: () => actions.activateTool('object') },
                { label: 'Entity', shortcut: 'E', action: () => actions.activateTool('entity') },
                { label: 'Light', shortcut: 'L', action: () => actions.activateTool('light') },
                { label: 'NavHint', shortcut: 'N', action: () => actions.activateTool('navHint') },
            ],
        },
        {
            title: 'Map',
            items: [
                { label: 'Map Properties', action: actions.mapProperties },
                { label: 'Floor Management', action: actions.floorManagement },
                { label: 'Signal Registry', action: actions.signalRegistry },
                'sep',
                { label: 'Compile Check', shortcut: 'Ctrl+Shift+B', action: actions.compile },
                { label: 'Play-Test', shortcut: 'Ctrl+P', action: actions.playTest },
            ],
        },
    ];

    for (const menu of menus) {
        container.appendChild(buildMenu(menu));
    }

    const compileIndicator = document.createElement('span');
    compileIndicator.id = 'editor-compile-status';
    compileIndicator.className = 'neutral';
    compileIndicator.textContent = '● Not compiled';
    compileIndicator.title = 'Click to toggle error panel';
    compileIndicator.addEventListener('click', () => actions.toggleErrorPanel());
    container.appendChild(compileIndicator);

    const title = document.createElement('div');
    title.id = 'editor-map-title';
    title.textContent = '';
    container.appendChild(title);

    document.addEventListener('pointerdown', (e) => {
        if (!(e.target instanceof Node) || !container.contains(e.target)) {
            closeAllMenus(container);
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllMenus(container);
    });

    return {
        titleEl: title,
        setCompileStatus(result: CompileResult | null): void {
            if (!result) {
                compileIndicator.className = 'neutral';
                compileIndicator.textContent = '● Not compiled';
                return;
            }
            if (result.passed) {
                compileIndicator.className = 'passed';
                compileIndicator.textContent = '✓ No errors';
            } else {
                const n = result.errors.length;
                compileIndicator.className = 'failed';
                compileIndicator.textContent = `✗ ${n} error${n === 1 ? '' : 's'}`;
            }
        },
    };
}

function buildMenu(spec: MenuSpec): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'editor-menu';
    const titleEl = document.createElement('div');
    titleEl.className = 'editor-menu-title';
    titleEl.textContent = spec.title;
    menu.appendChild(titleEl);

    const dropdown = document.createElement('div');
    dropdown.className = 'editor-menu-dropdown';
    menu.appendChild(dropdown);

    for (const item of spec.items) {
        if (item === 'sep') {
            const sep = document.createElement('div');
            sep.className = 'editor-menu-sep';
            dropdown.appendChild(sep);
            continue;
        }
        const row = document.createElement('div');
        const enabled = typeof item.action === 'function';
        row.className = `editor-menu-item ${enabled ? 'enabled' : 'disabled'}`;
        row.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
        if (enabled) {
            row.addEventListener('click', () => {
                closeAllMenus(menu.parentElement!);
                item.action?.();
            });
        }
        dropdown.appendChild(row);
    }

    titleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains('open');
        closeAllMenus(menu.parentElement!);
        if (!isOpen) menu.classList.add('open');
    });

    titleEl.addEventListener('mouseenter', () => {
        const parent = menu.parentElement!;
        const anyOpen = parent.querySelector('.editor-menu.open');
        if (anyOpen && anyOpen !== menu) {
            closeAllMenus(parent);
            menu.classList.add('open');
        }
    });

    return menu;
}

function closeAllMenus(container: HTMLElement): void {
    container.querySelectorAll('.editor-menu.open').forEach((m) => m.classList.remove('open'));
}
