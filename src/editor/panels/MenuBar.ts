/**
 * Top menu bar. Phase 1: File menu is wired (New, Open, Save, Save As);
 * other menus display their items as disabled with shortcut hints.
 *
 * Part of the editor layer.
 */

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
    toggleGrid: () => void;
    toggleSnap: () => void;
}

/** Build the menu bar inside `container` and return a reference for updates. */
export function mountMenuBar(container: HTMLElement, actions: MenuBarActions): HTMLElement {
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
                { label: 'Cut', shortcut: 'Ctrl+X' },
                { label: 'Copy', shortcut: 'Ctrl+C' },
                { label: 'Paste', shortcut: 'Ctrl+V' },
                { label: 'Delete', shortcut: 'Delete' },
                { label: 'Select All', shortcut: 'Ctrl+A' },
            ],
        },
        {
            title: 'View',
            items: [
                { label: 'Toggle Grid', shortcut: 'G', action: actions.toggleGrid },
                { label: 'Toggle Snap', shortcut: 'Ctrl+G', action: actions.toggleSnap },
                'sep',
                { label: 'Zoom In', shortcut: 'Ctrl+=' },
                { label: 'Zoom Out', shortcut: 'Ctrl+-' },
                { label: 'Zoom to Fit', shortcut: 'Ctrl+0' },
                { label: 'Zoom 100%', shortcut: 'Ctrl+1' },
            ],
        },
        {
            title: 'Insert',
            items: [
                { label: 'Wall', shortcut: 'W' },
                { label: 'Zone', shortcut: 'Z' },
                { label: 'Object', shortcut: 'O' },
                { label: 'Entity', shortcut: 'E' },
                { label: 'Light', shortcut: 'L' },
                { label: 'NavHint', shortcut: 'N' },
            ],
        },
        {
            title: 'Map',
            items: [
                { label: 'Map Properties' },
                { label: 'Floor Management' },
                { label: 'Signal Registry' },
                'sep',
                { label: 'Compile Check', shortcut: 'Ctrl+Shift+B' },
                { label: 'Play-Test', shortcut: 'Ctrl+P' },
            ],
        },
    ];

    for (const menu of menus) {
        container.appendChild(buildMenu(menu));
    }

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

    return title;
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
