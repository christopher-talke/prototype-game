/**
 * Pure helper for Tab/Shift-Tab overlap cycling.
 *
 * Given the current hit list (topmost-first, includes the current item) and
 * the current guid, returns the next/previous guid in cycle order. Wraps at
 * both ends.
 *
 * Part of the editor layer.
 */

/**
 * Compute the neighbour of `currentGuid` in `hits`. Returns null when the
 * list is empty, has a single item, or `currentGuid` is not present.
 */
export function nextOverlapGuid(
    hits: string[],
    currentGuid: string,
    step: 1 | -1,
): string | null {
    const len = hits.length;
    if (len < 2) return null;
    const idx = hits.indexOf(currentGuid);
    if (idx < 0) return null;
    const next = (idx + step + len) % len;
    return hits[next];
}
