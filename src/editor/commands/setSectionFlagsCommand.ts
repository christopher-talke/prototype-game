/**
 * Factory: batch-set the `hidden` or `locked` flag across every member of a
 * section (kind + scope).
 *
 * Scope matches the unified-tree section definitions:
 *  - layer-scoped kinds (wall/object/entity/decal/light) take `layerId`
 *  - zones take `floorId`
 *  - navHints are global (neither scope field applies)
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import type { EditorWorkingState, ItemKind } from '../state/EditorWorkingState';
import { SnapshotCommand } from './SnapshotCommand';
import { cloneMapData } from './mapMutators';

export type SectionFlag = 'hidden' | 'locked';

export interface SectionScope {
    floorId?: string;
    layerId?: string;
}

/** Build a batch flag-set command. Returns null when nothing would change. */
export function buildSetSectionFlagCommand(
    state: EditorWorkingState,
    kind: ItemKind,
    scope: SectionScope,
    flag: SectionFlag,
    value: boolean,
): SnapshotCommand | null {
    const before = JSON.stringify(state.map);
    const working = cloneMapData(state.map);
    let touched = 0;
    forEachInSection(working, kind, scope, (item) => {
        const current = (item as Record<string, unknown>)[flag];
        const normalized = current === true;
        if (normalized !== value) {
            (item as Record<string, unknown>)[flag] = value;
            touched += 1;
        }
    });
    if (touched === 0) return null;
    const after = JSON.stringify(working);
    if (after === before) return null;
    const verb = value ? (flag === 'hidden' ? 'Hide' : 'Lock') : (flag === 'hidden' ? 'Show' : 'Unlock');
    return new SnapshotCommand(before, after, `${verb} ${kind}s`, false);
}

function forEachInSection(
    map: MapData,
    kind: ItemKind,
    scope: SectionScope,
    fn: (item: unknown) => void,
): void {
    if (kind === 'zone') {
        for (const z of map.zones) {
            if (scope.floorId !== undefined && z.floorId && z.floorId !== scope.floorId) continue;
            fn(z);
        }
        return;
    }
    if (kind === 'navHint') {
        for (const n of map.navHints) fn(n);
        return;
    }
    for (const layer of map.layers) {
        if (scope.layerId !== undefined && layer.id !== scope.layerId) continue;
        const arr = arrayForKind(layer, kind);
        if (!arr) continue;
        for (const item of arr) fn(item);
    }
}

function arrayForKind(
    layer: MapData['layers'][number],
    kind: ItemKind,
): unknown[] | null {
    switch (kind) {
        case 'wall': return layer.walls;
        case 'object': return layer.objects;
        case 'entity': return layer.entities;
        case 'decal': return layer.decals;
        case 'light': return layer.lights;
        default: return null;
    }
}
