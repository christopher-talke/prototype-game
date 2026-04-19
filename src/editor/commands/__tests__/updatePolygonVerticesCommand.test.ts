import { describe, it, expect } from 'vitest';

import type { MapData, Vec2, Wall, Zone } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildUpdatePolygonVerticesCommand } from '../updatePolygonVerticesCommand';

const WALL_ID = 'wall-1';
const ZONE_ID = 'zone-1';

const SQUARE_CW: Vec2[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
];

function mkWall(id: string, vertices: Vec2[]): Wall {
    return {
        id,
        vertices,
        solid: true,
        bulletPenetrable: false,
        penetrationDecay: 0,
        audioOcclude: true,
        occludesVision: true,
        wallType: 'concrete',
    };
}

function mkZone(id: string, polygon: Vec2[]): Zone {
    return {
        id,
        type: 'trigger',
        label: id,
        polygon,
        floorId: 'ground',
    };
}

function mkMap(): MapData {
    const map = createDefaultMapData();
    map.layers[0].walls.push(mkWall(WALL_ID, SQUARE_CW.map((v) => ({ ...v }))));
    map.zones.push(mkZone(ZONE_ID, SQUARE_CW.map((v) => ({ ...v }))));
    return map;
}

describe('buildUpdatePolygonVerticesCommand', () => {
    it('returns null when newVertices has fewer than 3 entries', () => {
        const state = createWorkingState(mkMap());
        expect(buildUpdatePolygonVerticesCommand(state, WALL_ID, [])).toBe(null);
        expect(
            buildUpdatePolygonVerticesCommand(state, WALL_ID, [{ x: 0, y: 0 }, { x: 1, y: 1 }]),
        ).toBe(null);
    });

    it('returns null when the result is not convex', () => {
        const state = createWorkingState(mkMap());
        // Bowtie: crossing diagonals.
        const bowtie: Vec2[] = [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
        ];
        expect(buildUpdatePolygonVerticesCommand(state, WALL_ID, bowtie)).toBe(null);
    });

    it('returns null when the GUID matches no wall or zone', () => {
        const state = createWorkingState(mkMap());
        expect(buildUpdatePolygonVerticesCommand(state, 'nope', SQUARE_CW)).toBe(null);
    });

    it('returns null on no-op (same vertices)', () => {
        const state = createWorkingState(mkMap());
        expect(buildUpdatePolygonVerticesCommand(state, WALL_ID, SQUARE_CW)).toBe(null);
        expect(buildUpdatePolygonVerticesCommand(state, ZONE_ID, SQUARE_CW)).toBe(null);
    });

    it('updates a wall and round-trips through undo/redo', () => {
        const state = createWorkingState(mkMap());
        const moved: Vec2[] = [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
            { x: 0, y: 10 },
        ];
        const cmd = buildUpdatePolygonVerticesCommand(state, WALL_ID, moved);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        const wallAfter = state.map.layers[0].walls.find((w) => w.id === WALL_ID)!;
        expect(wallAfter.vertices).toEqual(moved);

        cmd!.undo(state);
        const wallRestored = state.map.layers[0].walls.find((w) => w.id === WALL_ID)!;
        expect(wallRestored.vertices).toEqual(SQUARE_CW);

        cmd!.do(state);
        const wallRedone = state.map.layers[0].walls.find((w) => w.id === WALL_ID)!;
        expect(wallRedone.vertices).toEqual(moved);
    });

    it('updates a zone and round-trips through undo/redo', () => {
        const state = createWorkingState(mkMap());
        const moved: Vec2[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 20 },
            { x: 0, y: 20 },
        ];
        const cmd = buildUpdatePolygonVerticesCommand(state, ZONE_ID, moved);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        const zoneAfter = state.map.zones.find((z) => z.id === ZONE_ID)!;
        expect(zoneAfter.polygon).toEqual(moved);

        cmd!.undo(state);
        const zoneRestored = state.map.zones.find((z) => z.id === ZONE_ID)!;
        expect(zoneRestored.polygon).toEqual(SQUARE_CW);

        cmd!.do(state);
        const zoneRedone = state.map.zones.find((z) => z.id === ZONE_ID)!;
        expect(zoneRedone.polygon).toEqual(moved);
    });

    it('normalises CCW input to CW before storing', () => {
        const state = createWorkingState(mkMap());
        // CCW triangle (reverse winding) expanding the wall significantly.
        const ccw: Vec2[] = [
            { x: 0, y: 10 },
            { x: 20, y: 10 },
            { x: 10, y: 0 },
        ];
        const cmd = buildUpdatePolygonVerticesCommand(state, WALL_ID, ccw);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        const wall = state.map.layers[0].walls.find((w) => w.id === WALL_ID)!;
        // CW of the CCW input = reversed order.
        expect(wall.vertices).toEqual([...ccw].reverse());
    });

    it('marks the command as structural', () => {
        const state = createWorkingState(mkMap());
        const moved: Vec2[] = [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
            { x: 0, y: 10 },
        ];
        const cmd = buildUpdatePolygonVerticesCommand(state, WALL_ID, moved);
        expect(cmd!.isStructural).toBe(true);
        expect(cmd!.description).toBe('Edit vertices');
    });
});
