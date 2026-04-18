/**
 * Display-name counters per item type.
 *
 * Names are human-readable sugar (`wall-7`). GUIDs are real identity.
 * Counters are monotonic per type: delete wall-2, next new wall is still
 * the next unseen number.
 *
 * Part of the editor layer.
 */

export type DisplayNameCounters = Map<string, number>;

/** Construct an empty counter map. */
export function createCounters(): DisplayNameCounters {
    return new Map();
}

/**
 * Allocate the next display name for the given type, incrementing the counter.
 * Returns e.g. `wall-7`.
 */
export function nextDisplayName(counters: DisplayNameCounters, type: string): string {
    const next = (counters.get(type) ?? 0) + 1;
    counters.set(type, next);
    return `${type}-${next}`;
}

/**
 * Seed the counter for `type` from a list of existing names. Any name matching
 * `{type}-{n}` contributes `n` to the max. Non-numeric suffixes are ignored.
 * The counter is set to max so the next allocation yields max + 1.
 */
export function seedCounterFromNames(
    counters: DisplayNameCounters,
    type: string,
    names: string[],
): void {
    const prefix = `${type}-`;
    let max = counters.get(type) ?? 0;

    for (const name of names) {
        if (!name.startsWith(prefix)) continue;
        const rest = name.slice(prefix.length);
        if (!/^\d+$/.test(rest)) continue;
        const n = Number.parseInt(rest, 10);
        if (n > max) max = n;
    }
    counters.set(type, max);
}
