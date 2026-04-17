/**
 * AI compiler -- turns `MapData.navHints` into a typed, per-type bucketed
 * registry that AI consumers read instead of filtering the flat array. Phase
 * 2f scope: registry + weighted sampling. Pathfinding graph deferred.
 *
 * Orchestration layer: AI reads the registry at match start, no per-frame
 * coupling to `MapData`.
 *
 * Editor visualisation convention (for future work):
 *  - cover   -> green, weight drives alpha
 *  - choke   -> yellow
 *  - flank   -> purple
 *  - danger  -> red
 *  - objective -> cyan
 *  The NavHint.radius is rendered as a ring; weight as fill opacity.
 */

import type { MapData, NavHint, NavHintType } from '@shared/map/MapData';

/** Per-type bucketed hint registry. Arrays are reused -- never clone externally. */
export class NavHintRegistry {
    private readonly byType = new Map<NavHintType, NavHint[]>();

    constructor(hints: readonly NavHint[]) {
        for (const h of hints) {
            let bucket = this.byType.get(h.type);
            if (!bucket) {
                bucket = [];
                this.byType.set(h.type, bucket);
            }
            bucket.push(h);
        }
        // Sort each bucket highest-weight first so linear reads front-load priority.
        for (const bucket of this.byType.values()) bucket.sort((a, b) => b.weight - a.weight);
    }

    /** Returns the bucketed array for `type` (empty if none). Do not mutate. */
    getByType(type: NavHintType): readonly NavHint[] {
        return this.byType.get(type) ?? EMPTY;
    }

    /** True when the registry has at least one hint of `type`. */
    hasType(type: NavHintType): boolean {
        return this.byType.has(type);
    }
}

const EMPTY: readonly NavHint[] = [];

/** Convenience constructor used by the orchestration bootstrap. */
export function compileNavHints(map: MapData): NavHintRegistry {
    return new NavHintRegistry(map.navHints);
}

/**
 * Weighted sampling over a bucket. `rng` defaults to `Math.random`; injected
 * for deterministic tests. Returns `null` only on an empty bucket.
 */
export function sampleWeighted(hints: readonly NavHint[], rng: () => number = Math.random): NavHint | null {
    if (hints.length === 0) return null;
    let total = 0;
    for (const h of hints) total += h.weight;
    if (total <= 0) return hints[0];
    let pick = rng() * total;
    for (const h of hints) {
        pick -= h.weight;
        if (pick <= 0) return h;
    }
    return hints[hints.length - 1];
}
