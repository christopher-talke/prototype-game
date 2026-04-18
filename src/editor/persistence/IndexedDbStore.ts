/**
 * Thin IndexedDB wrapper for the editor.
 *
 * Three stores: editorState (keyed by filePath), recentFiles (keyed by
 * filePath, stores FileSystemFileHandle), autosave (keyed by
 * `{filePath}::autosave`).
 *
 * Part of the editor layer.
 */

const DB_NAME = 'sightline-editor';
const DB_VERSION = 1;

export const STORE_EDITOR_STATE = 'editorState';
export const STORE_RECENT_FILES = 'recentFiles';
export const STORE_AUTOSAVE = 'autosave';

let openPromise: Promise<IDBDatabase> | null = null;

/** Open (and if needed, create) the editor IndexedDB. Singleton-cached. */
export function openDb(): Promise<IDBDatabase> {
    if (openPromise) return openPromise;
    openPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_EDITOR_STATE)) {
                db.createObjectStore(STORE_EDITOR_STATE);
            }
            if (!db.objectStoreNames.contains(STORE_RECENT_FILES)) {
                db.createObjectStore(STORE_RECENT_FILES);
            }
            if (!db.objectStoreNames.contains(STORE_AUTOSAVE)) {
                db.createObjectStore(STORE_AUTOSAVE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return openPromise;
}

/** Read a value by key. Resolves to `undefined` if not present. */
export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
    const db = await openDb();
    return new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

/** Write `value` at `key`. */
export async function idbPut<T>(store: string, key: string, value: T): Promise<void> {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value as unknown as any, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Delete the value at `key`. */
export async function idbDelete(store: string, key: string): Promise<void> {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
