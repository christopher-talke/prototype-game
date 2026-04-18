/**
 * Plain DOM right-click context menu. Closes on outside click or Escape.
 *
 * Item descriptors carry a label, optional shortcut text (decorative only,
 * actual binding is in shortcutMap), enabled flag, optional submenu (one
 * level), and an action callback. Separator items are rendered as a divider.
 *
 * Part of the editor layer.
 */

export interface MenuItem {
    label: string;
    shortcut?: string;
    enabled?: boolean;
    onClick?: () => void;
    submenu?: MenuItem[];
    separator?: boolean;
}

let activeMenu: HTMLElement | null = null;
let activeOutside: ((e: MouseEvent) => void) | null = null;
let activeKeydown: ((e: KeyboardEvent) => void) | null = null;

/** Open a context menu at the screen point. Closes any prior menu. */
export function openContextMenu(items: MenuItem[], screenX: number, screenY: number): void {
    closeContextMenu();
    if (items.length === 0) return;
    const menu = buildMenu(items);
    menu.style.position = 'fixed';
    menu.style.left = `${screenX}px`;
    menu.style.top = `${screenY}px`;
    document.body.appendChild(menu);
    activeMenu = menu;

    const outside = (e: MouseEvent) => {
        if (activeMenu && !activeMenu.contains(e.target as Node)) closeContextMenu();
    };
    const keydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeContextMenu();
    };
    activeOutside = outside;
    activeKeydown = keydown;
    setTimeout(() => {
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', keydown);
    }, 0);
}

/** Close any active context menu. No-op if none. */
export function closeContextMenu(): void {
    if (!activeMenu) return;
    activeMenu.remove();
    activeMenu = null;
    if (activeOutside) document.removeEventListener('mousedown', activeOutside);
    if (activeKeydown) document.removeEventListener('keydown', activeKeydown);
    activeOutside = null;
    activeKeydown = null;
}

function buildMenu(items: MenuItem[]): HTMLElement {
    const ul = document.createElement('ul');
    ul.className = 'editor-context-menu';
    for (const item of items) {
        if (item.separator) {
            const li = document.createElement('li');
            li.className = 'editor-context-separator';
            ul.appendChild(li);
            continue;
        }
        const li = document.createElement('li');
        li.className = 'editor-context-item';
        const enabled = item.enabled !== false;
        if (!enabled) li.classList.add('disabled');

        const label = document.createElement('span');
        label.className = 'editor-context-label';
        label.textContent = item.label;
        li.appendChild(label);

        if (item.shortcut) {
            const shortcut = document.createElement('span');
            shortcut.className = 'editor-context-shortcut';
            shortcut.textContent = item.shortcut;
            li.appendChild(shortcut);
        }

        if (item.submenu && item.submenu.length > 0) {
            li.classList.add('has-submenu');
            const sub = buildMenu(item.submenu);
            sub.classList.add('submenu');
            li.appendChild(sub);
        } else if (enabled && item.onClick) {
            const onClick = item.onClick;
            li.addEventListener('click', () => {
                closeContextMenu();
                onClick();
            });
        }
        ul.appendChild(li);
    }
    return ul;
}
