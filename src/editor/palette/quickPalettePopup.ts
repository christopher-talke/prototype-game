/**
 * Floating overlay variant of the object/entity palette.
 *
 * Positioned at the cursor with `position: fixed`. Closes on Esc, outside
 * click, or when the user picks an entry.
 *
 * Part of the editor layer.
 */

import { mountEntityPalette } from './entityPalette';
import { mountObjectPalette } from './objectPalette';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { PaletteRecents } from '../persistence/editorStatePersistence';

export type QuickPaletteKind = 'object' | 'entity';

let activePopup: HTMLElement | null = null;
let activeOutside: ((e: MouseEvent) => void) | null = null;
let activeKey: ((e: KeyboardEvent) => void) | null = null;

export interface QuickPaletteOptions {
    state: EditorWorkingState;
    recents: PaletteRecents;
    kind: QuickPaletteKind;
    screenX: number;
    screenY: number;
    onPick: (defId: string) => void;
}

/** Open a quick palette popup. Closes any prior popup. */
export function openQuickPalette(opts: QuickPaletteOptions): void {
    closeQuickPalette();
    const popup = document.createElement('div');
    popup.className = 'editor-quick-palette';
    popup.style.position = 'fixed';
    popup.style.left = `${opts.screenX}px`;
    popup.style.top = `${opts.screenY}px`;
    document.body.appendChild(popup);
    activePopup = popup;

    const onPick = (defId: string) => {
        opts.onPick(defId);
        closeQuickPalette();
    };
    if (opts.kind === 'object') {
        mountObjectPalette(popup, { state: opts.state, recents: opts.recents, onPick });
    } else {
        mountEntityPalette(popup, { state: opts.state, recents: opts.recents, onPick });
    }

    const outside = (e: MouseEvent) => {
        if (activePopup && !activePopup.contains(e.target as Node)) closeQuickPalette();
    };
    const keydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeQuickPalette();
    };
    activeOutside = outside;
    activeKey = keydown;
    setTimeout(() => {
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', keydown);
    }, 0);
}

export function closeQuickPalette(): void {
    if (!activePopup) return;
    activePopup.remove();
    activePopup = null;
    if (activeOutside) document.removeEventListener('mousedown', activeOutside);
    if (activeKey) document.removeEventListener('keydown', activeKey);
    activeOutside = null;
    activeKey = null;
}
