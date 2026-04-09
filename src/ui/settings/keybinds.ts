const STORAGE_KEY = 'game-keybinds';

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
    { action: 'grenade', label: 'Throw Grenade', key: 'g' },
    { action: 'buyMenu', label: 'Buy Menu', key: 'b' },
    { action: 'leaderboard', label: 'Leaderboard', key: 'Tab' },
    { action: 'settings', label: 'Settings', key: 'l' },
];

// Runtime bind map: key (lowercase) -> action
const keyToAction = new Map<string, ActionId>();
// action -> key for display / reverse lookup
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
    // Tab, Escape etc stay as-is; letters go lowercase
    return key.length === 1 ? key.toLowerCase() : key;
}

export function getActionForKey(key: string): ActionId | undefined {
    return keyToAction.get(normalizeKey(key));
}

export function getKeyForAction(action: ActionId): string {
    return actionToKey.get(action) ?? '';
}

export function getKeyDisplayName(key: string): string {
    if (key === ' ') return 'Space';
    if (key.length === 1) return key.toUpperCase();
    return key; // Tab, Escape, etc.
}

export function getAllBinds(): { action: ActionId; label: string; key: string }[] {
    return DEFAULT_BINDS.map((b) => ({
        action: b.action,
        label: b.label,
        key: actionToKey.get(b.action) ?? b.key,
    }));
}

export function setKeybind(action: ActionId, newKey: string) {
    // Remove any other action on this key
    const normalized = normalizeKey(newKey);
    const existing = keyToAction.get(normalized);
    if (existing && existing !== action) {
        // Swap: give the displaced action the old key of the target
        const oldKey = actionToKey.get(action) ?? '';
        actionToKey.set(existing, oldKey);
        keyToAction.set(normalizeKey(oldKey), existing);
    }
    // Remove old key for this action
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

// Init on import
loadBinds();
