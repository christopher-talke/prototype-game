/**
 * Factory: update the vertex array of an existing Wall or Zone. Structural.
 *
 * Used by the Vertex Edit sub-tool for drag-commit, insert-vertex, and
 * delete-vertex operations. Rejects non-convex results and inputs with fewer
 * than 3 vertices; winding is normalised to CW before comparison.
 *
 * Part of the editor layer.
 */

import type { Vec2, Wall, Zone } from '@shared/map/MapData';

import { enforceCW, isConvexCW } from '../geometry/polygon';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { cloneMapData } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

/**
 * Build a SnapshotCommand that replaces the vertex array of the polygon
 * identified by `guid` (a Wall or Zone). Returns null when:
 *   - newVertices has fewer than 3 entries;
 *   - the CW-normalised result fails convexity;
 *   - no Wall or Zone with that GUID exists;
 *   - the before/after JSON are identical (no-op).
 */
export function buildUpdatePolygonVerticesCommand(
    state: EditorWorkingState,
    guid: string,
    newVertices: Vec2[],
): SnapshotCommand | null {
    if (newVertices.length < 3) return null;
    const cw = enforceCW(newVertices);
    if (!isConvexCW(cw).convex) return null;

    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);

    const cloned = cw.map((v) => ({ x: v.x, y: v.y }));

    let applied = false;
    for (const layer of working.layers) {
        const wall = layer.walls.find((w) => w.id === guid) as Wall | undefined;
        if (wall) {
            wall.vertices = cloned;
            applied = true;
            break;
        }
    }
    if (!applied) {
        const zone = working.zones.find((z) => z.id === guid) as Zone | undefined;
        if (zone) {
            zone.polygon = cloned;
            applied = true;
        }
    }
    if (!applied) return null;

    const after = JSON.stringify(working);
    if (before === after) return null;
    return new SnapshotCommand(before, after, 'Edit vertices', true);
}
