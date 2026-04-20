/**
 * Tests for the pure `composeBreadcrumb` helper behind the left-panel
 * breadcrumb. Node-environment friendly (no DOM needed for string logic).
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type { MapData, NavHint, Wall, Zone } from '@shared/map/MapData';

import { createDefaultMapData } from '../../../state/defaultMap';
import { createWorkingState } from '../../../state/EditorWorkingState';
import { composeBreadcrumb } from '../breadcrumb';

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

function seedMap(): MapData {
    const map = createDefaultMapData();
    map.layers[0].walls.push(mkWall('wall-a', 'North Fence'));
    map.layers[0].walls.push(mkWall('wall-b', 'South Fence'));
    map.zones.push(mkZone('zone-a', 'Bombsite A', 'ground'));
    map.navHints.push(mkNav('nav-a', 'West Choke'));
    return map;
}

const SEP = ' \u203A ';

describe('composeBreadcrumb', () => {
    it('returns empty string when nothing is selected', () => {
        const state = createWorkingState(seedMap());
        expect(composeBreadcrumb(state, [])).toBe('');
    });

    it('renders Floor - Section - Name for a single wall', () => {
        const state = createWorkingState(seedMap());
        expect(composeBreadcrumb(state, ['wall-a']))
            .toBe(`Floor Ground Floor${SEP}Walls${SEP}North Fence`);
    });

    it('renders Floor - Section - Name for a single zone', () => {
        const state = createWorkingState(seedMap());
        expect(composeBreadcrumb(state, ['zone-a']))
            .toBe(`Floor Ground Floor${SEP}Zones${SEP}Bombsite A`);
    });

    it('renders Section - Name for nav hint (no floor)', () => {
        const state = createWorkingState(seedMap());
        expect(composeBreadcrumb(state, ['nav-a']))
            .toBe(`Nav Hints${SEP}West Choke`);
    });

    it('renders count for multi-selection', () => {
        const state = createWorkingState(seedMap());
        expect(composeBreadcrumb(state, ['wall-a', 'wall-b', 'zone-a']))
            .toBe('3 items selected');
    });

    it('returns empty string when single guid is unknown', () => {
        const state = createWorkingState(seedMap());
        expect(composeBreadcrumb(state, ['no-such-guid'])).toBe('');
    });
});
