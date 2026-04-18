/**
 * Auto-save. Writes a MapData + timestamp snapshot to IndexedDB on a 60s
 * interval (only when dirty) and immediately after any structural command.
 *
 * Writes never touch the user's file -- only IDB key
 * `{filePath}::autosave`. On open, if an autosave exists with a timestamp
 * newer than the file's lastModified, the user is prompted to restore.
 *
 * Part of the editor layer.
 */

import { STORE_AUTOSAVE, idbGet, idbPut } from './IndexedDbStore';

const INTERVAL_MS = 60_000;

export interface AutoSaveRecord {
    timestamp: number;
    mapJson: string;
}

export interface AutoSaveDriver {
    getFilePathKey(): string;
    isDirty(): boolean;
    snapshotMapJson(): string;
}

/** Returns the IDB key for the autosave slot of a given file-path key. */
export function autoSaveKey(filePathKey: string): string {
    return `${filePathKey}::autosave`;
}

/** Write an autosave record for the current state. Safe to call even if not dirty. */
export async function writeAutoSave(driver: AutoSaveDriver): Promise<void> {
    const record: AutoSaveRecord = {
        timestamp: Date.now(),
        mapJson: driver.snapshotMapJson(),
    };
    await idbPut(STORE_AUTOSAVE, autoSaveKey(driver.getFilePathKey()), record);
}

/** Read the autosave record for a file-path key, or undefined. */
export async function readAutoSave(filePathKey: string): Promise<AutoSaveRecord | undefined> {
    return idbGet<AutoSaveRecord>(STORE_AUTOSAVE, autoSaveKey(filePathKey));
}

export class AutoSaveTimer {
    private interval: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly driver: AutoSaveDriver) {}

    start(): void {
        if (this.interval) return;
        this.interval = setInterval(() => {
            if (!this.driver.isDirty()) return;
            void writeAutoSave(this.driver);
        }, INTERVAL_MS);
    }

    stop(): void {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    /** Called by CommandStack listener after structural commands. */
    triggerImmediate(): void {
        void writeAutoSave(this.driver);
    }
}
