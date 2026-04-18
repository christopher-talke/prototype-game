/**
 * Editor compile step. Bridges the game's MapValidator output into
 * editor-friendly CompileError objects with GUID refs, layer IDs, floor IDs,
 * and world-space positions for viewport panning.
 *
 * Part of the editor layer.
 */

import { validateMap } from '@orchestration/bootstrap/MapValidator';

import type { EditorWorkingState } from '../state/EditorWorkingState';
import { boundsOfGUID } from '../selection/boundsOf';

export interface CompileError {
    severity: 'error' | 'warning';
    message: string;
    /** GUID of the offending item, or null for map-level errors. */
    itemGUID: string | null;
    layerId: string | null;
    floorId: string | null;
    worldPosition: { x: number; y: number } | null;
}

export interface CompileResult {
    passed: boolean;
    errors: CompileError[];
    timestamp: number;
}

/** Run the full map validation and return a CompileResult. Does not throw. */
export function runCompile(state: EditorWorkingState): CompileResult {
    const rawErrors = validateMap(state.map);
    const errors: CompileError[] = rawErrors.map((e) => toCompileError(state, e.path, e.message));
    return { passed: errors.length === 0, errors, timestamp: Date.now() };
}

/** Derive the set of layer IDs that have at least one error. */
export function errorLayerIds(result: CompileResult): Set<string> {
    const ids = new Set<string>();
    for (const e of result.errors) {
        if (e.layerId) ids.add(e.layerId);
    }
    return ids;
}

function toCompileError(
    state: EditorWorkingState,
    path: string,
    message: string,
): CompileError {
    const guid = extractItemGUID(path);
    const layerId = extractLayerId(path);

    let floorId: string | null = null;
    let worldPosition: { x: number; y: number } | null = null;

    if (guid && state.byGUID.has(guid)) {
        const ref = state.byGUID.get(guid)!;
        floorId = ref.floorId ?? null;

        if (!floorId && ref.kind === 'zone') {
            const zone = state.map.zones.find((z) => z.id === guid);
            floorId = zone?.floorId ?? null;
        }

        const bb = boundsOfGUID(state, guid);
        worldPosition = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    } else if (layerId) {
        const layer = state.map.layers.find((l) => l.id === layerId);
        if (layer) {
            const floor = state.map.floors.find((f) =>
                state.map.layers.some((l) => l.id === layerId && l.floorId === f.id),
            );
            floorId = floor?.id ?? null;
        }
    }

    return { severity: 'error', message, itemGUID: guid, layerId, floorId, worldPosition };
}

/**
 * Extract the layer ID from an error path.
 * `layers.{layerId}.walls.{id}` → `{layerId}`
 */
function extractLayerId(path: string): string | null {
    const segs = path.split('.');
    if (segs[0] === 'layers' && segs.length >= 2) return segs[1];
    return null;
}

/**
 * Extract the item GUID from an error path. Handles:
 * - `layers.{L}.walls.{id}`, `.objects.`, `.entities.`, `.lights.`, `.decals.`
 * - `layers.{L}.entities.{id}.initialState`
 * - `zones.{id}` and `zones.{id}.meta.*`
 * - `navHints.{id}`
 */
function extractItemGUID(path: string): string | null {
    const segs = path.split('.');
    if (segs[0] === 'layers' && segs.length >= 4) return segs[3];
    if (segs[0] === 'zones' && segs.length >= 2) return segs[1];
    if (segs[0] === 'navHints' && segs.length >= 2) return segs[1];
    return null;
}
