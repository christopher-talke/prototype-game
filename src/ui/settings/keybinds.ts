const STORAGE_KEY = 'game-keybinds';

/** Identifier for a bindable game action. */
export type ActionId = 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'reload' | 'weapon1' | 'weapon2' | 'weapon3' | 'grenade' | 'buyMenu' | 'leaderboard' | 'settings';

type KeybindEntry = { action: ActionId; label: string; key: string };

const DEFAULT_BINDS: KeybindEntry[] = [
    { action: 'moveUp', label: 'Move Up', key: 'w' },
    { action: 'moveDown', label: 'Move Down', key: 's' },
    { action: 'moveLeft', label: 'Move Left', key: 'a' },
    { action: 'moveRight', label: 'Move Right', key: 'd' },
    { action: 'reload', label: 'Reload', key: 'r' },
    { action: 'weapon1', label: 'Weapon 1', key: '1' },
    { action: 'weapon2', label: 'Weapon 2', key: '2' },
    { action: 'weapon3', label: 'Weapon 3', key: '3' },
    { action: 'grenade', label: 'Throw Grenade', key: 'f' },
    { action: 'buyMenu', label: 'Buy Menu', key: 'b' },
    { action: 'leaderboard', label: 'Leaderboard', key: 'Tab' },
    { action: 'settings', label: 'Settings', key: 'l' },
];

const keyToAction = new Map<string, ActionId>();
const actionToKey = new Map<ActionId, string>();

function rebuildMaps(binds: KeybindEntry[]) {
    keyToAction.clear();
    actionToKey.clear();
    for (const b of binds) {
        keyToAction.set(normalizeKey(b.key), b.action);
        actionToKey.set(b.action, b.key);
    }
}

function normalizeKey(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Looks up the game action bound to a keyboard key.
 * @param key - The `KeyboardEvent.key` value
 * @returns The action id, or undefined if no binding exists
 */
export function getActionForKey(key: string): ActionId | undefined {
    return keyToAction.get(normalizeKey(key));
}

/**
 * Returns the key string currently bound to the given action.
 * @param action - The action to look up
 * @returns The bound key, or empty string if unbound
 */
export function getKeyForAction(action: ActionId): string {
    return actionToKey.get(action) ?? '';
}

/**
 * Returns a human-readable label for a key (e.g. ' ' becomes 'Space').
 * @param key - Raw key string
 * @returns Display-friendly key name
 */
export function getKeyDisplayName(key: string): string {
    if (key === ' ') return 'Space';
    if (key.length === 1) return key.toUpperCase();
    return key;
}

/**
 * Returns all bindings with current key assignments, preserving the
 * default ordering for display in the settings panel.
 * @returns Array of action/label/key objects
 */
export function getAllBinds(): { action: ActionId; label: string; key: string }[] {
    return DEFAULT_BINDS.map((b) => ({
        action: b.action,
        label: b.label,
        key: actionToKey.get(b.action) ?? b.key,
    }));
}

/**
 * Assigns a new key to an action. If another action already uses that key,
 * the two bindings are swapped so no key is left unbound. Persists to
 * localStorage.
 * @param action - The action to rebind
 * @param newKey - The new `KeyboardEvent.key` value
 */
export function setKeybind(action: ActionId, newKey: string) {
    const normalized = normalizeKey(newKey);
    const existing = keyToAction.get(normalized);
    if (existing && existing !== action) {
        const oldKey = actionToKey.get(action) ?? '';
        actionToKey.set(existing, oldKey);
        keyToAction.set(normalizeKey(oldKey), existing);
    }

    const prevKey = actionToKey.get(action);
    if (prevKey) keyToAction.delete(normalizeKey(prevKey));

    keyToAction.set(normalized, action);
    actionToKey.set(action, newKey);
    saveBinds();
}

function saveBinds() {
    const data: Record<string, string> = {};
    for (const [action, key] of actionToKey) {
        data[action] = key;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
}

function loadBinds() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw) as Record<string, string>;
            const merged = DEFAULT_BINDS.map((b) => ({
                ...b,
                key: data[b.action] ?? b.key,
            }));
            rebuildMaps(merged);
            return;
        }
    } catch {}
    rebuildMaps(DEFAULT_BINDS);
}

loadBinds();
