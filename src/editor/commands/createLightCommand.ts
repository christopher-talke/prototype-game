/**
 * Factory: create a new LightPlacement on the given layer. Structural.
 *
 * Defaults: white colour, intensity 1, omnidirectional cone (2pi), direction 0,
 * shadows on. Cone can be edited via the right-panel lightForm after placement.
 *
 * Part of the editor layer.
 */

import type { LightPlacement, RGBColor, Vec2 } from '@shared/map/MapData';

import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { cloneMapData } from './mapMutators';
import { SnapshotCommand } from './SnapshotCommand';

export interface CreateLightResult {
    command: SnapshotCommand;
    newGuid: string;
}

const DEFAULT_COLOR: RGBColor = { r: 255, g: 255, b: 255 };

/**
 * Build a command that appends a new LightPlacement to `layerId`.
 * Returns null if the layer does not exist or radius is <= 0.
 */
export function buildCreateLightCommand(
    state: EditorWorkingState,
    layerId: string,
    position: Vec2,
    radius: number,
): CreateLightResult | null {
    if (radius <= 0) return null;
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    const layer = working.layers.find((l) => l.id === layerId);
    if (!layer) return null;

    const guid = newGuid();
    const counters = new Map(state.counters);
    const name = nextDisplayName(counters, 'light');

    const light: LightPlacement & { name: string } = {
        id: guid,
        name,
        position: { x: position.x, y: position.y },
        color: { ...DEFAULT_COLOR },
        intensity: 1,
        radius,
        coneAngle: Math.PI * 2,
        coneDirection: 0,
        castShadows: true,
    };
    layer.lights.push(light);

    const after = JSON.stringify(working);
    return {
        command: new SnapshotCommand(before, after, 'Create light', true),
        newGuid: guid,
    };
}
