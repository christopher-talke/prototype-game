import type { NetAdapter } from '@net/netAdapter';
import { offlineAdapter } from '@net/offlineAdapter';

let current: NetAdapter = offlineAdapter;

export function getAdapter(): NetAdapter {
    return current;
}

export function setAdapter(adapter: NetAdapter): void {
    current = adapter;
}
