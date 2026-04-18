/**
 * SHA-256 hash of MapData for undo-stack invalidation.
 *
 * On open, a mismatch between the persisted `contentHash` and the current
 * file's hash means the file was edited externally and the serialized undo
 * stack is no longer replayable against it, so it must be discarded.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import { canonicalJson } from './canonicalJson';

/** Compute the SHA-256 hex digest of the canonical JSON of `map`. */
export async function contentHash(map: MapData): Promise<string> {
    const json = canonicalJson(map);
    const bytes = new TextEncoder().encode(json);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
