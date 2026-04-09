import type { NetAdapter } from './netAdapter';
import { offlineAdapter } from './offlineAdapter';

let current: NetAdapter = offlineAdapter;

export function getAdapter(): NetAdapter {
    return current;
}

export function setAdapter(adapter: NetAdapter): void {
    current = adapter;
}
