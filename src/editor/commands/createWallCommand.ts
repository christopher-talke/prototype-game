/**
 * Factory: create a new Wall on the given layer. Structural.
 *
 * Allocates GUID + display name, appends to `layer.walls`. Returns the
 * SnapshotCommand and the new GUID so callers can update selection.
 *
 * Part of the editor layer.
 */

import type { Vec2, Wall, WallType } from '@shared/map/MapData';

import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { cloneMapData } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

export interface CreateWallResult {
    command: SnapshotCommand;
    newGuid: string;
}

export interface CreateWallOptions {
    wallType?: WallType;
    solid?: boolean;
    bulletPenetrable?: boolean;
    penetrationDecay?: number;
    audioOcclude?: boolean;
    occludesVision?: boolean;
}

/**
 * Build a command that appends a new Wall with `vertices` to `layerId`.
 * Returns null if the layer does not exist or vertices has fewer than 3 entries.
 */
export function buildCreateWallCommand(
    state: EditorWorkingState,
    layerId: string,
    vertices: Vec2[],
    opts: CreateWallOptions = {},
): CreateWallResult | null {
    if (vertices.length < 3) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const layer = working.layers.find((l) => l.id === layerId);
    if (!layer) return null;

    const guid = newGuid();
    const counters = new Map(state.counters);
    const name = nextDisplayName(counters, 'wall');

    const wall: Wall & { name: string } = {
        id: guid,
        name,
        vertices: vertices.map((v) => ({ x: v.x, y: v.y })),
        solid: opts.solid ?? true,
        bulletPenetrable: opts.bulletPenetrable ?? false,
        penetrationDecay: opts.penetrationDecay ?? 0,
        audioOcclude: opts.audioOcclude ?? true,
        occludesVision: opts.occludesVision ?? true,
        wallType: opts.wallType ?? 'concrete',
    };
    layer.walls.push(wall);

    const after = JSON.stringify(working);
    return {
        command: new SnapshotCommand(before, after, 'Create wall', true),
        newGuid: guid,
    };
}
