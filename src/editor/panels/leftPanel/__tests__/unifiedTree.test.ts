/**
 * Tests for the unified-tree model layer: section row collection, filter
 * behaviour, collapse-state resolution, and the highlighted-name renderer's
 * match-span logic. Pure logic only - no jsdom available in this test env.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, NavHint, Wall, Zone } from '@shared/map/MapData';

import { createDefaultMapData } from '../../../state/defaultMap';
import { createWorkingState } from '../../../state/EditorWorkingState';
import {
    ITEM_SECTIONS,
    collectSectionRows,
    matchesFilter,
    resolveSectionCollapsed,
    type SectionDef,
} from '../unifiedTreeModel';

function mkWall(id: string, label?: string): Wall {
    return {
        id,
        label,
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

function mkZone(id: string, label: string, floorId: string): Zone {
    return {
        id,
        type: 'trigger',
        label,
        floorId,
        polygon: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ],
    };
}

function mkNav(id: string, label?: string): NavHint {
    return {
        id,
        label,
        type: 'cover',
        position: { x: 0, y: 0 },
        radius: 50,
        weight: 1,
    };
}

function seedMultifloorMap(): MapData {
    const map = createDefaultMapData();
    map.floors.push({ id: 'upper', label: 'Upper', renderOrder: 1 });
    map.layers.push({
        id: 'layer-upper-collision',
        floorId: 'upper',
        type: 'collision',
        label: 'Upper Collision',
        locked: false,
        visible: true,
        walls: [],
        objects: [],
        entities: [],
        decals: [],
        lights: [],
    });
    map.layers[0].walls.push(mkWall('wall-n', 'North Fence'));
    map.layers[0].walls.push(mkWall('wall-s', 'South Fence'));
    map.layers[0].walls.push(mkWall('wall-e', 'East Gate'));
    map.layers[map.layers.length - 1].walls.push(mkWall('wall-u', 'Upper Rail'));
    map.zones.push(mkZone('zone-ground-1', 'Bombsite A', 'ground'));
    map.zones.push(mkZone('zone-upper-1', 'Upper Lobby', 'upper'));
    map.navHints.push(mkNav('nav-1', 'West Choke'));
    map.navHints.push(mkNav('nav-2', 'East Choke'));
    return map;
}

const WALLS_SECTION: SectionDef = ITEM_SECTIONS.find((s) => s.id === 'walls')!;
const ZONES_SECTION: SectionDef = ITEM_SECTIONS.find((s) => s.id === 'zones')!;
const NAV_SECTION: SectionDef = ITEM_SECTIONS.find((s) => s.id === 'nav')!;

describe('matchesFilter', () => {
    it('returns true on empty filter', () => {
        const ref = { kind: 'wall' as const, guid: 'abc-123', name: 'North Fence' };
        expect(matchesFilter(ref, '')).toBe(true);
    });

    it('matches case-insensitively on name', () => {
        const ref = { kind: 'wall' as const, guid: 'abc-123', name: 'North Fence' };
        expect(matchesFilter(ref, 'NORTH')).toBe(true);
        expect(matchesFilter(ref, 'fence')).toBe(true);
    });

    it('matches on guid prefix (first 8 chars)', () => {
        const ref = { kind: 'wall' as const, guid: 'abcd1234efgh5678', name: 'Some Wall' };
        expect(matchesFilter(ref, 'abcd1234')).toBe(true);
        expect(matchesFilter(ref, 'efgh5678')).toBe(false);
    });

    it('returns false when nothing matches', () => {
        const ref = { kind: 'wall' as const, guid: 'abc-123', name: 'North Fence' };
        expect(matchesFilter(ref, 'zzz')).toBe(false);
    });
});

describe('collectSectionRows', () => {
    it('returns walls on the active layer only (layer-scoped)', () => {
        const state = createWorkingState(seedMultifloorMap());
        const rows = collectSectionRows(state, WALLS_SECTION, '');
        const names = rows.filter((r) => r.kind === 'item').map((r) => r.ref!.name);
        expect(names.sort()).toEqual(['East Gate', 'North Fence', 'South Fence']);
    });

    it('filter narrows walls to matching rows', () => {
        const state = createWorkingState(seedMultifloorMap());
        const rows = collectSectionRows(state, WALLS_SECTION, 'north');
        const names = rows.filter((r) => r.kind === 'item').map((r) => r.ref!.name);
        expect(names).toEqual(['North Fence']);
    });

    it('zones section is floor-scoped not layer-scoped', () => {
        const state = createWorkingState(seedMultifloorMap());
        const rows = collectSectionRows(state, ZONES_SECTION, '');
        const names = rows.filter((r) => r.kind === 'item').map((r) => r.ref!.name);
        expect(names).toEqual(['Bombsite A']);
    });

    it('switching floors re-scopes zones', () => {
        const state = createWorkingState(seedMultifloorMap());
        state.activeFloorId = 'upper';
        state.activeLayerId = 'layer-upper-collision';
        const rows = collectSectionRows(state, ZONES_SECTION, '');
        const names = rows.filter((r) => r.kind === 'item').map((r) => r.ref!.name);
        expect(names).toEqual(['Upper Lobby']);
    });

    it('nav hints section is global: shows hints regardless of active floor/layer', () => {
        const state = createWorkingState(seedMultifloorMap());
        const ground = collectSectionRows(state, NAV_SECTION, '').map((r) => r.ref!.name);
        expect(ground.sort()).toEqual(['East Choke', 'West Choke']);
        state.activeFloorId = 'upper';
        state.activeLayerId = 'layer-upper-collision';
        const upper = collectSectionRows(state, NAV_SECTION, '').map((r) => r.ref!.name);
        expect(upper.sort()).toEqual(['East Choke', 'West Choke']);
    });

    it('nav hints section respects filter', () => {
        const state = createWorkingState(seedMultifloorMap());
        const rows = collectSectionRows(state, NAV_SECTION, 'west');
        expect(rows.map((r) => r.ref!.name)).toEqual(['West Choke']);
    });
});

describe('resolveSectionCollapsed', () => {
    it('uses default when no persisted entry', () => {
        expect(resolveSectionCollapsed({}, 'walls', false, false)).toBe(false);
        expect(resolveSectionCollapsed({}, 'palette-objects', true, false)).toBe(true);
    });

    it('uses persisted entry when present', () => {
        expect(resolveSectionCollapsed({ walls: true }, 'walls', false, false)).toBe(true);
        expect(resolveSectionCollapsed({ walls: false }, 'walls', true, false)).toBe(false);
    });

    it('a non-empty filter forces expanded regardless of persisted value', () => {
        expect(resolveSectionCollapsed({ walls: true }, 'walls', true, true)).toBe(false);
    });

    it('persisted flag is preserved (mutation test - object reused)', () => {
        const persisted: Record<string, boolean> = { walls: true };
        resolveSectionCollapsed(persisted, 'walls', false, true);
        expect(persisted.walls).toBe(true);
    });
});
