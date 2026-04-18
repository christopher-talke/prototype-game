/**
 * File I/O port. Adapters implement this -- File System Access for browsers,
 * Node `fs` for Electron (post-ship).
 *
 * Part of the editor layer.
 */

export interface OpenResult {
    handle: FileSystemFileHandle;
    data: string;
    lastModified: number;
}

export interface FileService {
    /** Write `data` to `handle`. */
    save(data: string, handle: FileSystemFileHandle): Promise<void>;
    /** Prompt for a new location, write `data`, return the new handle. */
    saveAs(data: string): Promise<FileSystemFileHandle>;
    /** Prompt for a file to open; return handle and file text. */
    open(): Promise<OpenResult>;
}
