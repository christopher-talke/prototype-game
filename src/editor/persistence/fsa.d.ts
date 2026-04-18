/**
 * Supplemental type declarations for the File System Access API that TS 4.9's
 * lib.dom.d.ts does not provide.
 *
 * Part of the editor layer.
 */

interface FileSystemHandlePermissionDescriptor {
    mode: 'read' | 'readwrite';
}

type PermissionState = 'granted' | 'denied' | 'prompt';

interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
    queryPermission(descriptor: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
}

interface SaveFilePickerOptions {
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
    suggestedName?: string;
}

interface Window {
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
