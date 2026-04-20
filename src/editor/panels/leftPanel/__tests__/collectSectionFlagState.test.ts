/**
 * Tests for collectSectionFlagState: the four-state resolver that drives the
 * section-header eye + padlock buttons.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, NavHint, Wall, Zone } from '@shared/map/MapData';

import { createDefaultMapData } from '../../../state/defaultMap';
import { createWorkingState } from '../../../state/EditorWorkingState';
import { collectSectionFlagState, type SectionDef } from '../unifiedTreeModel';

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

const WALLS: SectionDef = { id: 'walls', title: 'Walls', kinds: ['wall'] };
const ZONES: SectionDef = { id: 'zones', title: 'Zones', kinds: ['zone'], floorScoped: true };
const NAV: SectionDef = { id: 'nav', title: 'Nav Hints', kinds: ['navHint'], global: true };

describe('collectSectionFlagState', () => {
    it('reports empty when the section has no items', () => {
        const state = createWorkingState(createDefaultMapData());
        const s = collectSectionFlagState(state, WALLS);
        expect(s.empty).toBe(true);
        expect(s.anyVisible).toBe(false);
        expect(s.allHidden).toBe(false);
        expect(s.anyUnlocked).toBe(false);
        expect(s.allLocked).toBe(false);
    });

    it('reports all-visible / all-unlocked when no flags are set', () => {
        const state = createWorkingState(mkMapWithWalls(['a', 'b']));
        const s = collectSectionFlagState(state, WALLS);
        expect(s.empty).toBe(false);
        expect(s.anyVisible).toBe(true);
        expect(s.allHidden).toBe(false);
        expect(s.anyUnlocked).toBe(true);
        expect(s.allLocked).toBe(false);
    });

    it('reports all-hidden when every item is hidden', () => {
        const state = createWorkingState(mkMapWithWalls(['a', 'b']));
        for (const w of state.map.layers[0].walls) w.hidden = true;
        const s = collectSectionFlagState(state, WALLS);
        expect(s.anyVisible).toBe(false);
        expect(s.allHidden).toBe(true);
    });

    it('mixed hidden/visible resolves to anyVisible + not-allHidden', () => {
        const state = createWorkingState(mkMapWithWalls(['a', 'b']));
        state.map.layers[0].walls[0].hidden = true;
        const s = collectSectionFlagState(state, WALLS);
        expect(s.anyVisible).toBe(true);
        expect(s.allHidden).toBe(false);
    });

    it('reports all-locked when every item is locked', () => {
        const state = createWorkingState(mkMapWithWalls(['a', 'b']));
        for (const w of state.map.layers[0].walls) (w as { locked?: boolean }).locked = true;
        const s = collectSectionFlagState(state, WALLS);
        expect(s.anyUnlocked).toBe(false);
        expect(s.allLocked).toBe(true);
    });

    it('zone section is scoped to the active floor', () => {
        const map = createDefaultMapData();
        map.floors.push({ id: 'upstairs', label: 'Up', renderOrder: 1 });
        const z1 = mkZone('z1', 'ground');
        const z2 = mkZone('z2', 'upstairs');
        (z1 as { hidden?: boolean }).hidden = true;
        map.zones.push(z1, z2);
        const state = createWorkingState(map);
        // Active floor is ground; only z1 counts, which is hidden.
        const s = collectSectionFlagState(state, ZONES);
        expect(s.empty).toBe(false);
        expect(s.allHidden).toBe(true);
    });

    it('navHint section ignores floor/layer scoping', () => {
        const map = createDefaultMapData();
        map.navHints.push(mkNav('n1'), mkNav('n2'));
        const state = createWorkingState(map);
        const s = collectSectionFlagState(state, NAV);
        expect(s.empty).toBe(false);
        expect(s.anyVisible).toBe(true);
    });

    it('layer-scoped section only counts items on the active layer', () => {
        const map = createDefaultMapData();
        map.layers.push({
            id: 'layer-other',
            floorId: 'ground',
            type: 'object',
            label: 'Other',
            locked: false,
            visible: true,
            walls: [mkWall('other-wall')],
            objects: [],
            entities: [],
            decals: [],
            lights: [],
        });
        map.layers[0].walls.push(mkWall('active-wall'));
        (map.layers[0].walls[0] as { hidden?: boolean }).hidden = true;
        const state = createWorkingState(map);
        // activeLayerId is 'layer-collision'; only 'active-wall' counts, which is hidden.
        const s = collectSectionFlagState(state, WALLS);
        expect(s.allHidden).toBe(true);
    });
});
