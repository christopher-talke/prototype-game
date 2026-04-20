/**
 * Tests for buildReorderItemCommand: splices a guid within its backing array
 * for layers, root items, zones, and nav hints. Rejects cross-array /
 * cross-floor drags. Undo/redo round-trip.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, NavHint, Wall, Zone } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildReorderItemCommand } from '../reorderItemCommand';

function mkWall(id: string): Wall {
    return {
        id,
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ],
        solid: true,
        bulletPenetrable: false,
        penetrationDecay: 0,
        audioOcclude: true,
        occludesVision: true,
        wallType: 'concrete',
    };
}

function mkZone(id: string, floorId?: string): Zone {
    return {
        id,
        type: 'spawn',
        label: id,
        polygon: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ],
        ...(floorId ? { floorId } : {}),
    };
}

function mkNav(id: string): NavHint {
    return { id, type: 'cover', position: { x: 0, y: 0 }, radius: 5, weight: 1 };
}

function mkMapWithWalls(ids: string[]): MapData {
    const map = createDefaultMapData();
    for (const id of ids) map.layers[0].walls.push(mkWall(id));
    return map;
}

function ids(arr: Array<{ id: string }>): string[] {
    return arr.map((x) => x.id);
}

describe('buildReorderItemCommand', () => {
    it('reorders walls within a layer (before)', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2', 'w3', 'w4']));
        const cmd = buildReorderItemCommand(state, 'w4', 'w2', 'before');
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        expect(ids(state.map.layers[0].walls)).toEqual(['w1', 'w4', 'w2', 'w3']);
    });

    it('reorders walls within a layer (after)', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2', 'w3', 'w4']));
        const cmd = buildReorderItemCommand(state, 'w1', 'w3', 'after');
        cmd!.do(state);
        expect(ids(state.map.layers[0].walls)).toEqual(['w2', 'w3', 'w1', 'w4']);
    });

    it('reorders zones on the same floor', () => {
        const map = createDefaultMapData();
        map.zones.push(mkZone('z1', 'ground'), mkZone('z2', 'ground'), mkZone('z3', 'ground'));
        const state = createWorkingState(map);
        const cmd = buildReorderItemCommand(state, 'z3', 'z1', 'before');
        cmd!.do(state);
        expect(ids(state.map.zones)).toEqual(['z3', 'z1', 'z2']);
    });

    it('rejects cross-floor zone reorder', () => {
        const map = createDefaultMapData();
        map.floors.push({ id: 'upstairs', label: 'Up', renderOrder: 1 });
        map.zones.push(mkZone('z1', 'ground'), mkZone('z2', 'upstairs'));
        const state = createWorkingState(map);
        expect(buildReorderItemCommand(state, 'z1', 'z2', 'before')).toBe(null);
    });

    it('reorders navHints', () => {
        const map = createDefaultMapData();
        map.navHints.push(mkNav('n1'), mkNav('n2'), mkNav('n3'));
        const state = createWorkingState(map);
        const cmd = buildReorderItemCommand(state, 'n1', 'n3', 'after');
        cmd!.do(state);
        expect(ids(state.map.navHints)).toEqual(['n2', 'n3', 'n1']);
    });

    it('reorders layers within a floor', () => {
        const map = createDefaultMapData();
        map.layers.push({
            id: 'layer-objects',
            floorId: 'ground',
            type: 'object',
            label: 'Objects',
            locked: false,
            visible: true,
            walls: [],
            objects: [],
            entities: [],
            decals: [],
            lights: [],
        });
        const state = createWorkingState(map);
        const cmd = buildReorderItemCommand(state, 'layer-objects', 'layer-collision', 'before');
        cmd!.do(state);
        expect(state.map.layers[0].id).toBe('layer-objects');
        expect(state.map.layers[1].id).toBe('layer-collision');
    });

    it('rejects cross-floor layer reorder', () => {
        const map = createDefaultMapData();
        map.floors.push({ id: 'upstairs', label: 'Up', renderOrder: 1 });
        map.layers.push({
            id: 'up-collision',
            floorId: 'upstairs',
            type: 'collision',
            label: 'Up',
            locked: false,
            visible: true,
            walls: [],
            objects: [],
            entities: [],
            decals: [],
            lights: [],
        });
        const state = createWorkingState(map);
        expect(
            buildReorderItemCommand(state, 'up-collision', 'layer-collision', 'before'),
        ).toBe(null);
    });

    it('rejects cross-array reorder (wall to zone)', () => {
        const map = createDefaultMapData();
        map.layers[0].walls.push(mkWall('w1'));
        map.zones.push(mkZone('z1', 'ground'));
        const state = createWorkingState(map);
        expect(buildReorderItemCommand(state, 'w1', 'z1', 'before')).toBe(null);
    });

    it('returns null on unknown guid', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2']));
        expect(buildReorderItemCommand(state, 'nope', 'w1', 'before')).toBe(null);
        expect(buildReorderItemCommand(state, 'w1', 'nope', 'before')).toBe(null);
    });

    it('returns null when moving onto self', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2']));
        expect(buildReorderItemCommand(state, 'w1', 'w1', 'before')).toBe(null);
    });

    it('returns null when the requested position is a no-op (already adjacent)', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2', 'w3']));
        expect(buildReorderItemCommand(state, 'w2', 'w3', 'before')).toBe(null);
        expect(buildReorderItemCommand(state, 'w2', 'w1', 'after')).toBe(null);
    });

    it('undo restores the original order', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2', 'w3', 'w4']));
        const cmd = buildReorderItemCommand(state, 'w4', 'w2', 'before');
        cmd!.do(state);
        expect(ids(state.map.layers[0].walls)).toEqual(['w1', 'w4', 'w2', 'w3']);
        cmd!.undo(state);
        expect(ids(state.map.layers[0].walls)).toEqual(['w1', 'w2', 'w3', 'w4']);
        cmd!.do(state);
        expect(ids(state.map.layers[0].walls)).toEqual(['w1', 'w4', 'w2', 'w3']);
    });
});
