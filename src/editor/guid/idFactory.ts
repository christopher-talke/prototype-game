/**
 * GUID factory for editor items.
 *
 * Wraps `crypto.randomUUID()` so item creation has a single choke point.
 * Part of the editor layer.
 */

/** Generate a new UUIDv4 for an editor item. */
export function newGuid(): string {
    return crypto.randomUUID();
}
