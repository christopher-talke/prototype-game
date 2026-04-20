/**
 * Tests for buildSetSectionFlagCommand: batch `hidden` / `locked` toggle
 * across a section (kind + scope), with undo/redo round-trip.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, NavHint, Wall, Zone } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildSetSectionFlagCommand } from '../setSectionFlagsCommand';

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

function mkZone(id: string, floorId: string): Zone {
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
        floorId,
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

describe('buildSetSectionFlagCommand', () => {
    it('hides every wall on the active layer', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2', 'w3']));
        const cmd = buildSetSectionFlagCommand(
            state,
            'wall',
            { layerId: state.activeLayerId },
            'hidden',
            true,
        );
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        for (const w of state.map.layers[0].walls) {
            expect(w.hidden).toBe(true);
        }
    });

    it('locks every object on the active layer', () => {
        const map = createDefaultMapData();
        map.layers[0].objects.push(
            { id: 'o1', objectDefId: 'crate', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } },
            { id: 'o2', objectDefId: 'crate', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } },
        );
        const state = createWorkingState(map);
        const cmd = buildSetSectionFlagCommand(
            state,
            'object',
            { layerId: state.activeLayerId },
            'locked',
            true,
        );
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        for (const o of state.map.layers[0].objects) {
            expect((o as { locked?: boolean }).locked).toBe(true);
        }
    });

    it('shows every zone on the active floor (some were hidden)', () => {
        const map = createDefaultMapData();
        const z1 = mkZone('z1', 'ground');
        const z2 = mkZone('z2', 'ground');
        (z1 as { hidden?: boolean }).hidden = true;
        map.zones.push(z1, z2);
        const state = createWorkingState(map);
        const cmd = buildSetSectionFlagCommand(
            state,
            'zone',
            { floorId: state.activeFloorId },
            'hidden',
            false,
        );
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        // z1 flipped true -> false; z2 was already effectively visible
        // (undefined), the command leaves it untouched.
        expect((state.map.zones[0] as { hidden?: boolean }).hidden).toBe(false);
        expect((state.map.zones[1] as { hidden?: boolean }).hidden).toBeUndefined();
    });

    it('ignores navHint scope fields and flips every navHint', () => {
        const map = createDefaultMapData();
        map.navHints.push(mkNav('n1'), mkNav('n2'));
        const state = createWorkingState(map);
        const cmd = buildSetSectionFlagCommand(state, 'navHint', {}, 'hidden', true);
        expect(cmd).not.toBe(null);
        cmd!.do(state);
        for (const n of state.map.navHints) {
            expect((n as { hidden?: boolean }).hidden).toBe(true);
        }
    });

    it('returns null when every item is already in the requested state', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2']));
        for (const w of state.map.layers[0].walls) w.hidden = true;
        expect(
            buildSetSectionFlagCommand(
                state,
                'wall',
                { layerId: state.activeLayerId },
                'hidden',
                true,
            ),
        ).toBe(null);
    });

    it('returns null when the section is empty', () => {
        const state = createWorkingState(createDefaultMapData());
        expect(
            buildSetSectionFlagCommand(
                state,
                'wall',
                { layerId: state.activeLayerId },
                'hidden',
                true,
            ),
        ).toBe(null);
    });

    it('undo restores prior per-item flags exactly', () => {
        const state = createWorkingState(mkMapWithWalls(['w1', 'w2', 'w3']));
        state.map.layers[0].walls[1].hidden = true;
        const cmd = buildSetSectionFlagCommand(
            state,
            'wall',
            { layerId: state.activeLayerId },
            'hidden',
            true,
        )!;
        cmd.do(state);
        expect(state.map.layers[0].walls.every((w) => w.hidden === true)).toBe(true);
        cmd.undo(state);
        expect(state.map.layers[0].walls[0].hidden).toBeUndefined();
        expect(state.map.layers[0].walls[1].hidden).toBe(true);
        expect(state.map.layers[0].walls[2].hidden).toBeUndefined();
    });

    it('scopes layer-level changes to the given layer only', () => {
        const map = createDefaultMapData();
        map.layers.push({
            id: 'layer-objects',
            floorId: 'ground',
            type: 'object',
            label: 'Objects',
            locked: false,
            visible: true,
            walls: [mkWall('other-wall')],
            objects: [],
            entities: [],
            decals: [],
            lights: [],
        });
        map.layers[0].walls.push(mkWall('active-wall'));
        const state = createWorkingState(map);
        const cmd = buildSetSectionFlagCommand(
            state,
            'wall',
            { layerId: state.activeLayerId },
            'hidden',
            true,
        );
        cmd!.do(state);
        expect(state.map.layers[0].walls[0].hidden).toBe(true);
        expect(state.map.layers[1].walls[0].hidden).toBeUndefined();
    });
});
