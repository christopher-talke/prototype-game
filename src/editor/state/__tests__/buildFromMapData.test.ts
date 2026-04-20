/**
 * Tests for buildFromMapData: verify label/name/id fallback for ItemRef.name
 * across every placement kind and zones/nav hints.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type {
    DecalPlacement,
    EntityPlacement,
    LightPlacement,
    NavHint,
    ObjectPlacement,
    Wall,
    Zone,
} from '@shared/map/MapData';

import { createDefaultMapData } from '../defaultMap';
import { createWorkingState } from '../EditorWorkingState';

function mkWall(id: string, label?: string): Wall {
    return {
        id,
        ...(label !== undefined ? { label } : {}),
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

function mkObject(id: string, label?: string): ObjectPlacement {
    return {
        id,
        ...(label !== undefined ? { label } : {}),
        objectDefId: 'obj-def',
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
    };
}

function mkEntity(id: string, label?: string): EntityPlacement {
    return {
        id,
        ...(label !== undefined ? { label } : {}),
        entityTypeId: 'ent-def',
        position: { x: 0, y: 0 },
        rotation: 0,
        initialState: {},
    };
}

function mkDecal(id: string, label?: string): DecalPlacement {
    return {
        id,
        ...(label !== undefined ? { label } : {}),
        assetPath: '',
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        alpha: 1,
        blendMode: 'normal',
    };
}

function mkLight(id: string, label?: string): LightPlacement {
    return {
        id,
        ...(label !== undefined ? { label } : {}),
        position: { x: 0, y: 0 },
        color: { r: 255, g: 255, b: 255 },
        intensity: 1,
        radius: 100,
        coneAngle: Math.PI * 2,
        coneDirection: 0,
        castShadows: false,
    };
}

function mkZone(id: string, label: string): Zone {
    return {
        id,
        type: 'trigger',
        label,
        polygon: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ],
        floorId: 'ground',
    };
}

function mkNavHint(id: string, label?: string): NavHint {
    return {
        id,
        ...(label !== undefined ? { label } : {}),
        type: 'cover',
        position: { x: 0, y: 0 },
        radius: 50,
        weight: 1,
    };
}

describe('buildFromMapData display-name fallback', () => {
    it('wall without label uses id', () => {
        const map = createDefaultMapData();
        map.layers[0].walls.push(mkWall('wall-1'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('wall-1')?.name).toBe('wall-1');
    });

    it('wall with label uses label', () => {
        const map = createDefaultMapData();
        map.layers[0].walls.push(mkWall('wall-1', 'North Fence'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('wall-1')?.name).toBe('North Fence');
    });

    it('object without label uses id', () => {
        const map = createDefaultMapData();
        map.layers[0].objects.push(mkObject('obj-1'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('obj-1')?.name).toBe('obj-1');
    });

    it('object with label uses label', () => {
        const map = createDefaultMapData();
        map.layers[0].objects.push(mkObject('obj-1', 'Crate A'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('obj-1')?.name).toBe('Crate A');
    });

    it('entity without label uses id', () => {
        const map = createDefaultMapData();
        map.layers[0].entities.push(mkEntity('ent-1'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('ent-1')?.name).toBe('ent-1');
    });

    it('entity with label uses label', () => {
        const map = createDefaultMapData();
        map.layers[0].entities.push(mkEntity('ent-1', 'Guard Bot'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('ent-1')?.name).toBe('Guard Bot');
    });

    it('decal without label uses id', () => {
        const map = createDefaultMapData();
        map.layers[0].decals.push(mkDecal('decal-1'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('decal-1')?.name).toBe('decal-1');
    });

    it('decal with label uses label', () => {
        const map = createDefaultMapData();
        map.layers[0].decals.push(mkDecal('decal-1', 'Blood Splat'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('decal-1')?.name).toBe('Blood Splat');
    });

    it('light without label uses id', () => {
        const map = createDefaultMapData();
        map.layers[0].lights.push(mkLight('light-1'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('light-1')?.name).toBe('light-1');
    });

    it('light with label uses label', () => {
        const map = createDefaultMapData();
        map.layers[0].lights.push(mkLight('light-1', 'Corner Lamp'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('light-1')?.name).toBe('Corner Lamp');
    });

    it('navHint without label uses id', () => {
        const map = createDefaultMapData();
        map.navHints.push(mkNavHint('nav-1'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('nav-1')?.name).toBe('nav-1');
    });

    it('navHint with label uses label', () => {
        const map = createDefaultMapData();
        map.navHints.push(mkNavHint('nav-1', 'Choke Point West'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('nav-1')?.name).toBe('Choke Point West');
    });

    it('zone always uses its required label', () => {
        const map = createDefaultMapData();
        map.zones.push(mkZone('zone-1', 'Spawn A'));
        const state = createWorkingState(map);
        expect(state.byGUID.get('zone-1')?.name).toBe('Spawn A');
    });

    it('legacy item with only `name` still resolves via name fallback', () => {
        const map = createDefaultMapData();
        const wall = mkWall('wall-legacy');
        (wall as unknown as { name: string }).name = 'Legacy Wall';
        map.layers[0].walls.push(wall);
        const state = createWorkingState(map);
        expect(state.byGUID.get('wall-legacy')?.name).toBe('Legacy Wall');
    });
});
