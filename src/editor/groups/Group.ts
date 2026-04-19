/**
 * Editor-only item group.
 *
 * Groups are a pure editor convenience: they never appear in MapData, they
 * only persist in IndexedDB editor state. A group has a single floor; members
 * can span layers within that floor. Groups may nest up to MAX_GROUP_DEPTH
 * levels deep (a member may itself be another group id).
 *
 * Part of the editor layer.
 */

export const MAX_GROUP_DEPTH = 4;

export interface Group {
    /** UUIDv4, unique across all items and groups in this editor session. */
    id: string;
    /** Human-readable, renameable. `group-N` default from the display-name counter. */
    name: string;
    /** All members must share this floor id. */
    floorId: string;
    /**
     * Item GUIDs and/or nested group ids. A group's immediate children live here.
     * Order is preserved for UI display only; it has no semantic meaning.
     */
    memberIds: string[];
    /** Null when this group is top-level (not nested inside another group). */
    parentGroupId: string | null;
}
