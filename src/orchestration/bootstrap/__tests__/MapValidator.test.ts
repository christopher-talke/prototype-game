import { describe, it, expect } from 'vitest';
import { validateMap } from '../MapValidator';
import type { MapData, EntityTypeDefinition, Zone } from '@shared/map/MapData';

function baseMap(): MapData {
    return {
        meta: {
            id: 'test',
            name: 'Test',
            author: '',
            version: 1,
            thumbnail: '',
            gameModes: ['tdm'],
            playerCount: { min: 2, max: 10, recommended: 6 },
        },
        bounds: {
            width: 1000,
            height: 1000,
            playableArea: { x: 0, y: 0, width: 1000, height: 1000 },
            oobKillMargin: 100,
        },
        postProcess: {
            bloomIntensity: 0,
            chromaticAberration: 0,
            ambientLightColor: { r: 0, g: 0, b: 0 },
            ambientLightIntensity: 0.2,
            vignetteIntensity: 0,
        },
        audio: { ambientLoop: null, reverbProfile: 'default' },
        objectDefs: [],
        entityDefs: [],
        floors: [{ id: 'ground', label: 'Ground', renderOrder: 0 }],
        signals: [],
        layers: [],
        zones: [],
        navHints: [],
    };
}

describe('validateMap', () => {
    it('accepts a minimal valid map', () => {
        expect(validateMap(baseMap())).toEqual([]);
    });

    it('rejects bounds with width <= 0', () => {
        const m = baseMap();
        m.bounds.width = 0;
        const errs = validateMap(m);
        expect(errs).toContainEqual(expect.objectContaining({ field: 'width' }));
    });

    it('rejects playableArea extending beyond world bounds', () => {
        const m = baseMap();
        m.bounds.playableArea = { x: 0, y: 0, width: 2000, height: 2000 };
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'rect')).toBe(true);
    });

    it('rejects playerCount where min > max', () => {
        const m = baseMap();
        m.meta.playerCount = { min: 10, max: 2, recommended: 6 };
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'ordering')).toBe(true);
    });

    it('rejects non-integer playerCount', () => {
        const m = baseMap();
        m.meta.playerCount = { min: 2.5, max: 10, recommended: 6 };
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'min/max/recommended')).toBe(true);
    });

    it('rejects duplicate floor renderOrder', () => {
        const m = baseMap();
        m.floors = [
            { id: 'a', label: 'A', renderOrder: 0 },
            { id: 'b', label: 'B', renderOrder: 0 },
        ];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'renderOrder')).toBe(true);
    });

    it('rejects layer with unknown floorId', () => {
        const m = baseMap();
        m.layers = [{
            id: 'L1', floorId: 'nonexistent', type: 'collision', label: 'L',
            locked: false, visible: true, walls: [], objects: [], entities: [], decals: [], lights: [],
        }];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'floorId')).toBe(true);
    });

    it('rejects concave polygon wall', () => {
        const m = baseMap();
        m.layers = [{
            id: 'L1', floorId: 'ground', type: 'collision', label: 'L',
            locked: false, visible: true,
            walls: [{
                id: 'w1',
                vertices: [
                    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 10 }, { x: 0, y: 10 },
                ],
                solid: true, bulletPenetrable: false, penetrationDecay: 0,
                audioOcclude: true, occludesVision: true, wallType: 'concrete',
            }],
            objects: [], entities: [], decals: [], lights: [],
        }];
        const errs = validateMap(m);
        expect(errs.some((e) => e.message === 'polygon is not convex')).toBe(true);
    });

    it('accepts a convex quad wall', () => {
        const m = baseMap();
        m.layers = [{
            id: 'L1', floorId: 'ground', type: 'collision', label: 'L',
            locked: false, visible: true,
            walls: [{
                id: 'w1',
                vertices: [
                    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
                ],
                solid: true, bulletPenetrable: false, penetrationDecay: 0,
                audioOcclude: true, occludesVision: true, wallType: 'concrete',
            }],
            objects: [], entities: [], decals: [], lights: [],
        }];
        expect(validateMap(m)).toEqual([]);
    });

    it('rejects light with intensity <= 0', () => {
        const m = baseMap();
        m.layers = [{
            id: 'L1', floorId: 'ground', type: 'collision', label: 'L',
            locked: false, visible: true, walls: [], objects: [], entities: [], decals: [],
            lights: [{
                id: 'l1', position: { x: 100, y: 100 },
                color: { r: 255, g: 255, b: 255 }, intensity: 0, radius: 200,
                coneAngle: Math.PI * 2, coneDirection: 0, castShadows: true,
            }],
        }];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'intensity')).toBe(true);
    });

    it('rejects navHint weight > 1', () => {
        const m = baseMap();
        m.navHints = [{ id: 'n1', type: 'cover', position: { x: 0, y: 0 }, radius: 100, weight: 1.5 }];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'weight')).toBe(true);
    });

    it('rejects zone with unknown floorId', () => {
        const m = baseMap();
        m.zones = [{ id: 'z1', type: 'spawn', label: 'Z', polygon: [], floorId: 'bogus', team: 't' }];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'floorId')).toBe(true);
    });

    it('rejects floor-transition zone with unknown fromFloorId', () => {
        const m = baseMap();
        const z: Zone = {
            id: 'z1', type: 'floor-transition', label: 'FT', polygon: [],
            meta: { fromFloorId: 'nope', toFloorId: 'ground', direction: 'up' },
        };
        m.zones = [z];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'meta.fromFloorId')).toBe(true);
    });

    it('rejects trigger zone referencing unknown signal', () => {
        const m = baseMap();
        const z: Zone = {
            id: 'z1', type: 'trigger', label: 'T', polygon: [],
            meta: { events: [{ on: 'enter', signal: 'nope', target: 'all', once: false, timeout: null }] },
        };
        m.zones = [z];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'signal')).toBe(true);
    });

    it('rejects trigger event target=team with no teamId', () => {
        const m = baseMap();
        m.signals = [{ id: 'sig', label: 'sig' }];
        const z: Zone = {
            id: 'z1', type: 'trigger', label: 'T', polygon: [],
            meta: { events: [{ on: 'enter', signal: 'sig', target: 'team', once: false, timeout: null }] },
        };
        m.zones = [z];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'teamId')).toBe(true);
    });

    it('rejects trigger event timeout <= 0', () => {
        const m = baseMap();
        m.signals = [{ id: 'sig', label: 'sig' }];
        const z: Zone = {
            id: 'z1', type: 'trigger', label: 'T', polygon: [],
            meta: { events: [{ on: 'enter', signal: 'sig', target: 'all', once: false, timeout: 0 }] },
        };
        m.zones = [z];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'timeout')).toBe(true);
    });

    it('rejects unknown objectDefId reference', () => {
        const m = baseMap();
        m.layers = [{
            id: 'L1', floorId: 'ground', type: 'object', label: 'L',
            locked: false, visible: true, walls: [], entities: [], decals: [], lights: [],
            objects: [{ id: 'o1', objectDefId: 'unknown', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }],
        }];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'objectDefId')).toBe(true);
    });

    it('validates entity stateSchema layerId field against known layers', () => {
        const m = baseMap();
        const entDef: EntityTypeDefinition = {
            id: 'generator', label: 'Generator',
            collisionShape: null, interactionRadius: 50,
            initialState: { powered: true, connectedLayerId: '' },
            stateSchema: {
                powered: { type: 'primitive' },
                connectedLayerId: { type: 'layerId' },
            },
            sprites: [], lights: [],
        };
        m.entityDefs = [entDef];
        m.layers = [{
            id: 'L1', floorId: 'ground', type: 'collision', label: 'L',
            locked: false, visible: true, walls: [], objects: [], decals: [], lights: [],
            entities: [{
                id: 'e1', entityTypeId: 'generator',
                position: { x: 0, y: 0 }, rotation: 0,
                initialState: { connectedLayerId: 'no_such_layer' },
            }],
        }];
        const errs = validateMap(m);
        expect(errs.some((e) => e.field === 'connectedLayerId')).toBe(true);
    });
});
