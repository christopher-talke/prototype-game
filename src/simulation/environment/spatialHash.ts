/**
 * Generic 2D uniform-grid spatial hash for broad-phase AABB queries.
 *
 * Layer: simulation -- environment sub-domain. Pure data structure with no
 * imports from rendering, net, or orchestration. Consumed by the per-floor
 * physics compiler (Phase 2a) and later sub-phases (dynamic entities, object
 * shapes) that need floor-keyed broad-phase culling.
 *
 * Items may straddle multiple cells and are therefore recorded in every cell
 * their AABB overlaps. A `queryAABB` that spans several cells will return the
 * same item once per overlapping cell; callers that need uniqueness must
 * dedupe (player collision does not -- overlap tests are idempotent booleans).
 *
 * The query result is written into a caller-supplied buffer to avoid per-frame
 * allocation on hot paths.
 */

export interface AABB {
    x: number;
    y: number;
    w: number;
    h: number;
}

export class SpatialHash<T> {
    private readonly cellSize: number;
    private readonly buckets = new Map<number, T[]>();
    private readonly _allItems: T[] = [];

    constructor(cellSize: number) {
        if (cellSize <= 0) throw new Error(`SpatialHash cellSize must be > 0 (got ${cellSize})`);
        this.cellSize = cellSize;
    }

    /** Inserts `item` into every cell its `aabb` overlaps. */
    insert(aabb: AABB, item: T): void {
        const minCx = Math.floor(aabb.x / this.cellSize);
        const minCy = Math.floor(aabb.y / this.cellSize);
        const maxCx = Math.floor((aabb.x + aabb.w) / this.cellSize);
        const maxCy = Math.floor((aabb.y + aabb.h) / this.cellSize);
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const k = SpatialHash.cellKey(cx, cy);
                let bucket = this.buckets.get(k);
                if (!bucket) {
                    bucket = [];
                    this.buckets.set(k, bucket);
                }
                bucket.push(item);
            }
        }
        this._allItems.push(item);
    }

    /**
     * Writes every item in any cell overlapping `aabb` into `out` (which is
     * cleared first). An item that straddles multiple cells may appear more
     * than once in `out`.
     */
    queryAABB(aabb: AABB, out: T[]): void {
        out.length = 0;
        const minCx = Math.floor(aabb.x / this.cellSize);
        const minCy = Math.floor(aabb.y / this.cellSize);
        const maxCx = Math.floor((aabb.x + aabb.w) / this.cellSize);
        const maxCy = Math.floor((aabb.y + aabb.h) / this.cellSize);
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const k = SpatialHash.cellKey(cx, cy);
                const bucket = this.buckets.get(k);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
            }
        }
    }

    /** Returns every item inserted into the hash, in insertion order. */
    all(): readonly T[] {
        return this._allItems;
    }

    /** Number of distinct items inserted (counts insertion calls, not cell records). */
    size(): number {
        return this._allItems.length;
    }

    private static cellKey(cx: number, cy: number): number {
        // Szudzik-like pairing over signed ints -- small negative cells are fine because
        // we bit-mask into a 31-bit key. Collision risk is tolerable for map-scale data.
        return ((cx | 0) * 73856093) ^ ((cy | 0) * 19349663);
    }
}
