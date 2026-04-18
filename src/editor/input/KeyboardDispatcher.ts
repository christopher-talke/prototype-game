/**
 * Global keyboard shortcut dispatcher.
 *
 * Single `window.keydown` listener resolves chord strings
 * (`ctrl+shift+s`, `ctrl+z`, `g`, etc) against a binding map. Chords ignore
 * keydowns while the user is typing in an input/textarea/contentEditable.
 *
 * Bindings that fire call `preventDefault`. Unbound chords pass through.
 *
 * Part of the editor layer.
 */

export type ShortcutHandler = () => void;

export class KeyboardDispatcher {
    private bindings: Map<string, ShortcutHandler> = new Map();

    constructor() {
        window.addEventListener('keydown', this.onKeyDown);
    }

    bind(chord: string, handler: ShortcutHandler): void {
        this.bindings.set(normalizeChord(chord), handler);
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (isEditableTarget(e.target)) return;
        const chord = buildChord(e);
        const handler = this.bindings.get(chord);
        if (!handler) return;
        e.preventDefault();
        handler();
    };
}

function buildChord(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(keyName(e));
    return parts.join('+');
}

function keyName(e: KeyboardEvent): string {
    const key = e.key;
    if (key === ' ') return 'space';
    if (key === 'Escape') return 'escape';
    if (key === 'Delete') return 'delete';
    if (key === '=') return '=';
    if (key === '-') return '-';
    if (key.length === 1) return key.toLowerCase();
    return key.toLowerCase();
}

function normalizeChord(chord: string): string {
    return chord
        .toLowerCase()
        .split('+')
        .map((p) => p.trim())
        .filter(Boolean)
        .sort((a, b) => weight(a) - weight(b))
        .join('+');
}

function weight(part: string): number {
    if (part === 'ctrl') return 0;
    if (part === 'shift') return 1;
    if (part === 'alt') return 2;
    return 10;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
}
