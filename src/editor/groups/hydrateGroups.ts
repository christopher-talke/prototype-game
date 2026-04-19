/**
 * Populate `state.groups` from persisted IndexedDB data and serialise the
 * other direction. Groups are editor-only, not part of MapData; they live
 * alongside it in `EditorStatePersisted`.
 *
 * On load we also bump the group display-name counter to stay ahead of any
 * existing `group-N` names, matching the scan pattern used for item kinds.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { SerializedGroup } from '../persistence/editorStatePersistence';
import { pruneGroupsAgainstItems } from './groupQueries';

/** Hydrate `state.groups` from persisted payload. */
export function hydrateGroups(state: EditorWorkingState, groups: SerializedGroup[]): void {
    state.groups.clear();
    let maxCounter = 0;
    for (const g of groups) {
        state.groups.set(g.id, {
            id: g.id,
            name: g.name,
            floorId: g.floorId,
            memberIds: [...g.memberIds],
            parentGroupId: g.parentGroupId,
        });
        const m = g.name.match(/^group-(\d+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n) && n > maxCounter) maxCounter = n;
        }
    }
    if (maxCounter > 0) {
        const existing = state.counters.get('group') ?? 0;
        if (maxCounter > existing) state.counters.set('group', maxCounter);
    }
    pruneGroupsAgainstItems(state);
}

/** Serialise `state.groups` for persistence. */
export function serializeGroups(state: EditorWorkingState): SerializedGroup[] {
    const out: SerializedGroup[] = [];
    for (const g of state.groups.values()) {
        out.push({
            id: g.id,
            name: g.name,
            floorId: g.floorId,
            memberIds: [...g.memberIds],
            parentGroupId: g.parentGroupId,
        });
    }
    return out;
}
