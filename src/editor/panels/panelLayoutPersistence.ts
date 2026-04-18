/**
 * Panel collapse state in localStorage.
 *
 * IndexedDB already persists collapse state per-file, but panels need their
 * layout applied *before* the Pixi app initialises (so the viewport size is
 * correct at startup). localStorage is synchronous and survives across files.
 *
 * Part of the editor layer.
 */

const KEY_LEFT = 'editor.panel.left.collapsed';
const KEY_RIGHT = 'editor.panel.right.collapsed';

export interface PanelCollapse {
    left: boolean;
    right: boolean;
}

export function loadPanelCollapse(): PanelCollapse {
    return {
        left: localStorage.getItem(KEY_LEFT) === '1',
        right: localStorage.getItem(KEY_RIGHT) === '1',
    };
}

export function savePanelCollapse(state: PanelCollapse): void {
    localStorage.setItem(KEY_LEFT, state.left ? '1' : '0');
    localStorage.setItem(KEY_RIGHT, state.right ? '1' : '0');
}
