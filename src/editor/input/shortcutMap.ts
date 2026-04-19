/**
 * Phase 1 + Phase 2 + Phase 4 shortcut bindings.
 *
 * Phase 1: file ops, undo/redo, grid/snap toggles.
 * Phase 2: tool shortcuts (S/W/Z/O/E/L/N), edit-clipboard (Ctrl+X/C/V/D),
 * delete (Delete/Backspace), select-all (Ctrl+A), Esc to cancel + return to
 * Select tool.
 * Phase 4: compile (Ctrl+Shift+B), play-test (Ctrl+P).
 *
 * Part of the editor layer.
 */

import type { MenuBarActions } from '../panels/MenuBar';
import type { KeyboardDispatcher } from './KeyboardDispatcher';

/** Register Phase 1 shortcuts against `dispatcher` wired to `actions`. */
export function installPhase1Shortcuts(dispatcher: KeyboardDispatcher, actions: MenuBarActions): void {
    dispatcher.bind('ctrl+s', actions.save);
    dispatcher.bind('ctrl+shift+s', actions.saveAs);
    dispatcher.bind('ctrl+o', actions.open);
    dispatcher.bind('ctrl+n', actions.newMap);
    dispatcher.bind('ctrl+z', actions.undo);
    dispatcher.bind('ctrl+shift+z', actions.redo);
    dispatcher.bind('g', actions.toggleGrid);
    dispatcher.bind('ctrl+g', actions.toggleSnap);
}

export interface Phase2ShortcutActions {
    activateTool: (toolId: string) => void;
    cancel: () => void;
    cut: () => void;
    copy: () => void;
    paste: () => void;
    duplicate: () => void;
    deleteSelection: () => void;
    selectAll: () => void;
    openQuickObject: () => void;
    openQuickEntity: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomReset: () => void;
    zoomFit: () => void;
}

/** Register Phase 2 shortcuts against `dispatcher`. */
export function installPhase2Shortcuts(
    dispatcher: KeyboardDispatcher,
    actions: Phase2ShortcutActions,
): void {
    dispatcher.bind('s', () => actions.activateTool('select'));
    dispatcher.bind('w', () => actions.activateTool('wall'));
    dispatcher.bind('z', () => actions.activateTool('zone'));
    dispatcher.bind('l', () => actions.activateTool('light'));
    dispatcher.bind('n', () => actions.activateTool('navHint'));
    dispatcher.bind('o', actions.openQuickObject);
    dispatcher.bind('e', actions.openQuickEntity);

    dispatcher.bind('escape', actions.cancel);

    dispatcher.bind('ctrl+x', actions.cut);
    dispatcher.bind('ctrl+c', actions.copy);
    dispatcher.bind('ctrl+v', actions.paste);
    dispatcher.bind('ctrl+d', actions.duplicate);
    dispatcher.bind('ctrl+a', actions.selectAll);

    dispatcher.bind('delete', actions.deleteSelection);
    dispatcher.bind('backspace', actions.deleteSelection);

    dispatcher.bind('ctrl+=', actions.zoomIn);
    dispatcher.bind('ctrl+-', actions.zoomOut);
    dispatcher.bind('ctrl+0', actions.zoomFit);
    dispatcher.bind('ctrl+1', actions.zoomReset);
}

export interface Phase5ShortcutActions {
    groupSelection: () => void;
    dissolveGroup: () => void;
    vertexEdit: () => void;
}

/** Register Phase 5 shortcuts: group creation, dissolution, vertex edit. */
export function installPhase5Shortcuts(
    dispatcher: KeyboardDispatcher,
    actions: Phase5ShortcutActions,
): void {
    dispatcher.bind('ctrl+shift+g', actions.groupSelection);
    dispatcher.bind('ctrl+shift+u', actions.dissolveGroup);
    dispatcher.bind('v', actions.vertexEdit);
}

export interface Phase4ShortcutActions {
    compile: () => void;
    playTest: () => void;
}

/** Register Phase 4 shortcuts: compile check and play-test. */
export function installPhase4Shortcuts(
    dispatcher: KeyboardDispatcher,
    actions: Phase4ShortcutActions,
): void {
    dispatcher.bind('ctrl+shift+b', actions.compile);
    dispatcher.bind('ctrl+p', actions.playTest);
}
