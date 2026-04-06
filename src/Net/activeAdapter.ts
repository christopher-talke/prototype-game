import type { NetAdapter } from './NetAdapter';
import { offlineAdapter } from './OfflineAdapter';

let current: NetAdapter = offlineAdapter;

export function getAdapter(): NetAdapter {
    return current;
}

export function setAdapter(adapter: NetAdapter): void {
    current = adapter;
}
