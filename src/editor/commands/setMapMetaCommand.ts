/**
 * Factories: build SnapshotCommands that patch MapData top-level sections.
 * Non-structural (do not create or delete items).
 *
 * Part of the editor layer.
 */

import type { MapAudioConfig, MapBounds, MapData, MapPostProcessProfile } from '@shared/map/MapData';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';

/** Build a command that merges `patch` into `map.meta`. Returns null if no change. */
export function buildSetMapMetaCommand(
    state: EditorWorkingState,
    patch: Partial<MapData['meta']>,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;
    Object.assign(working.meta, patch);
    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, 'Edit map properties', false);
}

export interface MapPropertiesPatch {
    meta?: Partial<MapData['meta']>;
    bounds?: Partial<Omit<MapBounds, 'playableArea'>> & {
        playableArea?: Partial<MapBounds['playableArea']>;
    };
    postProcess?: Partial<Omit<MapPostProcessProfile, 'ambientLightColor'>> & {
        ambientLightColor?: Partial<MapPostProcessProfile['ambientLightColor']>;
    };
    audio?: Partial<MapAudioConfig>;
}

/**
 * Build a command that patches meta, bounds, postProcess, and/or audio in one
 * operation. Handles nested objects (playableArea, ambientLightColor) via
 * shallow merge one level deep. Returns null if no change.
 */
export function buildSetMapPropertiesCommand(
    state: EditorWorkingState,
    patch: MapPropertiesPatch,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = JSON.parse(before) as MapData;

    if (patch.meta) {
        Object.assign(working.meta, patch.meta);
    }

    if (patch.bounds) {
        const { playableArea, ...rest } = patch.bounds;
        Object.assign(working.bounds, rest);
        if (playableArea) Object.assign(working.bounds.playableArea, playableArea);
    }

    if (patch.postProcess) {
        const { ambientLightColor, ...rest } = patch.postProcess;
        Object.assign(working.postProcess, rest);
        if (ambientLightColor) Object.assign(working.postProcess.ambientLightColor, ambientLightColor);
    }

    if (patch.audio) {
        Object.assign(working.audio, patch.audio);
    }

    const after = JSON.stringify(working);
    if (after === before) return null;
    return new SnapshotCommand(before, after, 'Edit map properties', false);
}
