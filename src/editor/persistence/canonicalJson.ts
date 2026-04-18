/**
 * Deterministic JSON serialization for hashing.
 *
 * Sorts object keys recursively so semantically identical MapData produces
 * identical byte output. Used by `contentHash` to detect external file edits
 * and invalidate the persisted undo stack.
 *
 * Part of the editor layer.
 */

/**
 * Serialise `value` to a JSON string with all object keys sorted lexicographically.
 * Arrays preserve order. Numbers use the default JS JSON encoding.
 */
export function canonicalJson(value: unknown): string {
    return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(sortDeep);

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};

    for (const k of keys) {
        out[k] = sortDeep(obj[k]);
    }
    return out;
}
