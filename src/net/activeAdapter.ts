/**
 * Singleton holder for the active network adapter.
 *
 * Net layer - provides a single access point so the game loop and other
 * consumers can reach the current adapter without passing it explicitly.
 * Defaults to the offline adapter; swapped to the WebSocket adapter when
 * connecting to a remote server.
 */

import type { NetAdapter } from '@net/netAdapter';
import { offlineAdapter } from '@net/offlineAdapter';

let current: NetAdapter = offlineAdapter;

/** Returns the currently active {@link NetAdapter}. */
export function getAdapter(): NetAdapter {
    return current;
}

/**
 * Replaces the active adapter.
 * @param adapter - The adapter to install as current.
 */
export function setAdapter(adapter: NetAdapter): void {
    current = adapter;
}
