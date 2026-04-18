/**
 * Factory: create a new NavHint at the given position. Structural.
 *
 * NavHints are map-level (not per-layer). Allocates GUID + display name,
 * appends to `map.navHints`.
 *
 * Part of the editor layer.
 */

import type { NavHint, NavHintType, Vec2 } from '@shared/map/MapData';

import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { cloneMapData } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

export interface CreateNavHintResult {
    command: SnapshotCommand;
    newGuid: string;
}

/**
 * Build a command that appends a new NavHint to `map.navHints`.
 * Returns null if radius is <= 0.
 */
export function buildCreateNavHintCommand(
    state: EditorWorkingState,
    type: NavHintType,
    position: Vec2,
    radius: number,
    weight: number,
): CreateNavHintResult | null {
    if (radius <= 0) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);

    const guid = newGuid();
    const counters = new Map(state.counters);
    const name = nextDisplayName(counters, 'navHint');

    const hint: NavHint & { name: string } = {
        id: guid,
        name,
        type,
        position: { x: position.x, y: position.y },
        radius,
        weight: Math.max(0, Math.min(1, weight)),
    };
    working.navHints.push(hint);

    const after = JSON.stringify(working);
    return {
        command: new SnapshotCommand(before, after, 'Create nav hint', true),
        newGuid: guid,
    };
}
