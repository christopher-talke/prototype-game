import { describe, it, expect } from 'vitest';
import type { MapData, MapLayer, ObjectDefinition, LightPlacement } from '@shared/map/MapData';
import {
    compileObjectPlacements,
    compileStandaloneLights,
    compileAllLights,
} from '@orchestration/bootstrap/rendererCompiler';
import { ObjectDefRegistry } from '@orchestration/bootstrap/objectDefRegistry';

function baseMap(): MapData {
    return {
        meta: {
            id: 'm', name: 'm', author: '', version: 1,
            thumbnail: '', gameModes: [], playerCount: { min: 1, max: 1, recommended: 1 },
        },
        bounds: { width: 1000, height: 1000, playableArea: { x: 0, y: 0, width: 1000, height: 1000 }, oobKillMargin: 0 },
        postProcess: {
            bloomIntensity: 0, chromaticAberration: 0,
            ambientLightColor: { r: 0, g: 0, b: 0 }, ambientLightIntensity: 0, vignetteIntensity: 0,
        },
        audio: { ambientLoop: null, reverbProfile: 'none' },
        objectDefs: [],
        entityDefs: [],
        floors: [{ id: 'ground', label: 'Ground', renderOrder: 0 }],
        signals: [],
        layers: [],
        zones: [],
        navHints: [],
    };
}

function emptyLayer(id: string, floorId: string, type: MapLayer['type']): MapLayer {
    return {
        id, floorId, type, label: id,
        visible: true, locked: false,
        walls: [], objects: [], entities: [], decals: [], lights: [],
    };
}

function lamp(): ObjectDefinition {
    return {
        id: 'lamp',
        label: 'Lamp',
        collisionShape: null,
        sprites: [],
        pivot: { x: 0, y: 0 },
        lights: [
            {
                offset: { x: 10, y: 0 },
                color: { r: 255, g: 200, b: 100 },
                intensity: 1,
                radius: 200,
                coneAngle: 0,
                coneDirection: 0,
                castShadows: false,
            },
        ],
    };
}

describe('compileObjectPlacements light world transform', () => {
    it('translates an unrotated placement by position', () => {
        const map = baseMap();
        map.objectDefs = [lamp()];
        map.layers = [
            {
                ...emptyLayer('l', 'ground', 'object'),
                objects: [{ id: 'p', objectDefId: 'lamp', position: { x: 500, y: 500 }, rotation: 0, scale: { x: 1, y: 1 } }],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const [obj] = compileObjectPlacements(map, reg);
        expect(obj.lights[0].position.x).toBeCloseTo(510);
        expect(obj.lights[0].position.y).toBeCloseTo(500);
        expect(obj.lights[0].coneDirection).toBeCloseTo(0);
    });

    it('applies placement rotation to both offset and coneDirection', () => {
        const map = baseMap();
        map.objectDefs = [lamp()];
        map.layers = [
            {
                ...emptyLayer('l', 'ground', 'object'),
                objects: [{ id: 'p', objectDefId: 'lamp', position: { x: 100, y: 100 }, rotation: Math.PI / 2, scale: { x: 1, y: 1 } }],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const [obj] = compileObjectPlacements(map, reg);
        expect(obj.lights[0].position.x).toBeCloseTo(100);
        expect(obj.lights[0].position.y).toBeCloseTo(110);
        expect(obj.lights[0].coneDirection).toBeCloseTo(Math.PI / 2);
    });

    it('tags every compiled light with the containing layer floorId', () => {
        const map = baseMap();
        map.objectDefs = [lamp()];
        map.floors = [
            { id: 'ground', label: 'G', renderOrder: 0 },
            { id: 'upper', label: 'U', renderOrder: 1 },
        ];
        map.layers = [
            {
                ...emptyLayer('gl', 'ground', 'object'),
                objects: [{ id: 'p1', objectDefId: 'lamp', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }],
            },
            {
                ...emptyLayer('ul', 'upper', 'object'),
                objects: [{ id: 'p2', objectDefId: 'lamp', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const out = compileObjectPlacements(map, reg);
        const byId = Object.fromEntries(out.map((o) => [o.placementId, o]));
        expect(byId.p1.lights[0].floorId).toBe('ground');
        expect(byId.p2.lights[0].floorId).toBe('upper');
    });

    it('uses deterministic `${placementId}__${index}` ids so compiled lights are stable across rebuilds', () => {
        const map = baseMap();
        const twoLamp: ObjectDefinition = {
            ...lamp(),
            lights: [lamp().lights[0], { ...lamp().lights[0], offset: { x: -10, y: 0 } }],
        };
        map.objectDefs = [twoLamp];
        map.layers = [
            {
                ...emptyLayer('l', 'ground', 'object'),
                objects: [{ id: 'fixture', objectDefId: 'lamp', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const [obj] = compileObjectPlacements(map, reg);
        expect(obj.lights.map((l) => l.id)).toEqual(['fixture__0', 'fixture__1']);
    });
});

describe('compileStandaloneLights', () => {
    it('returns every layer light tagged with the layer floorId', () => {
        const map = baseMap();
        const l1: LightPlacement = {
            id: 'l1', position: { x: 10, y: 10 },
            color: { r: 255, g: 255, b: 255 }, intensity: 1, radius: 100,
            coneAngle: 0, coneDirection: 0, castShadows: true,
        };
        map.layers = [
            { ...emptyLayer('gl', 'ground', 'floor'), lights: [l1] },
        ];
        const out = compileStandaloneLights(map);
        expect(out.length).toBe(1);
        expect(out[0].id).toBe('l1');
        expect(out[0].floorId).toBe('ground');
    });
});

describe('compileAllLights', () => {
    it('unions standalone + object-attached lights', () => {
        const map = baseMap();
        map.objectDefs = [lamp()];
        const standaloneLight: LightPlacement = {
            id: 'standalone', position: { x: 0, y: 0 },
            color: { r: 255, g: 255, b: 255 }, intensity: 1, radius: 100,
            coneAngle: 0, coneDirection: 0, castShadows: false,
        };
        map.layers = [
            { ...emptyLayer('fl', 'ground', 'floor'), lights: [standaloneLight] },
            {
                ...emptyLayer('ol', 'ground', 'object'),
                objects: [{ id: 'lamp1', objectDefId: 'lamp', position: { x: 100, y: 100 }, rotation: 0, scale: { x: 1, y: 1 } }],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const out = compileAllLights(map, reg);
        expect(out.map((l) => l.id).sort()).toEqual(['lamp1__0', 'standalone']);
    });
});
