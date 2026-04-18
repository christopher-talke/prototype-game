/**
 * File System Access API adapter for the `FileService` port.
 *
 * Browser-only (Chrome, Edge, Electron). `handle.createWritable()` opens
 * a writer; we write and close to trigger the actual flush.
 *
 * Part of the editor layer.
 */

import type { FileService, OpenResult } from './FileService';

const PICKER_TYPES: FilePickerAcceptType[] = [
    {
        description: 'Sightline Map',
        accept: { 'application/json': ['.json'] },
    },
];

export class FileSystemAccessService implements FileService {
    async save(data: string, handle: FileSystemFileHandle): Promise<void> {
        await ensurePermission(handle, 'readwrite');
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
    }

    async saveAs(data: string): Promise<FileSystemFileHandle> {
        const handle = await window.showSaveFilePicker({
            types: PICKER_TYPES,
            suggestedName: 'map.json',
        });
        await this.save(data, handle);
        return handle;
    }

    async open(): Promise<OpenResult> {
        const [handle] = await window.showOpenFilePicker({
            types: PICKER_TYPES,
            multiple: false,
        });
        await ensurePermission(handle, 'readwrite');
        const file = await handle.getFile();
        const data = await file.text();
        return { handle, data, lastModified: file.lastModified };
    }
}

async function ensurePermission(
    handle: FileSystemFileHandle,
    mode: 'read' | 'readwrite',
): Promise<void> {
    const opts = { mode } as FileSystemHandlePermissionDescriptor;
    const current = await handle.queryPermission(opts);
    if (current === 'granted') return;
    const requested = await handle.requestPermission(opts);
    if (requested !== 'granted') {
        throw new Error('File permission denied');
    }
}
