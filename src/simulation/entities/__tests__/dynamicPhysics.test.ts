import { describe, it, expect } from 'vitest';
import type { MapData, MapLayer, EntityTypeDefinition, EntityPlacement } from '@shared/map/MapData';
import { EntityRegistry } from '@simulation/entities/entityRegistry';
import { EntityDefRegistry } from '@orchestration/bootstrap/entityDefRegistry';
import { pointInsideEntityOnFloor, collectEntityAABBs } from '@simulation/entities/dynamicPhysics';

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
        floors: [
            { id: 'ground', label: 'G', renderOrder: 0 },
            { id: 'upper', label: 'U', renderOrder: 1 },
        ],
        signals: [], layers: [], zones: [], navHints: [],
    };
}

function emptyLayer(id: string, floorId: string): MapLayer {
    return {
        id, floorId, type: 'object', label: id,
        visible: true, locked: false,
        walls: [], objects: [], entities: [], decals: [], lights: [],
    };
}

function doorDef(): EntityTypeDefinition {
    return {
        id: 'door',
        label: 'Door',
        collisionShape: { type: 'aabb', x: -20, y: -5, width: 40, height: 10 },
        interactionRadius: 30,
        initialState: { open: false },
        sprites: [],
        lights: [],
    };
}

function doorPlacement(id: string, x: number, y: number): EntityPlacement {
    return { id, entityTypeId: 'door', position: { x, y }, rotation: 0, initialState: {} };
}

function setup(floorOfDoor: string): { map: MapData; reg: EntityRegistry } {
    const map = baseMap();
    map.entityDefs = [doorDef()];
    map.layers = [{ ...emptyLayer('l', floorOfDoor), entities: [doorPlacement('door1', 100, 100)] }];
    const reg = EntityRegistry.fromMap(map, new EntityDefRegistry(map.entityDefs));
    return { map, reg };
}

describe('dynamicPhysics point-in-entity', () => {
    it('closed door blocks a probe inside its local AABB', () => {
        const { reg } = setup('ground');
        expect(pointInsideEntityOnFloor(reg, 'ground', { x: 100, y: 100 })).toBe(true);
        expect(pointInsideEntityOnFloor(reg, 'ground', { x: 100, y: 102 })).toBe(true);
    });

    it('probes outside the shape pass through', () => {
        const { reg } = setup('ground');
        expect(pointInsideEntityOnFloor(reg, 'ground', { x: 200, y: 200 })).toBe(false);
    });

    it('opening the door clears collision at the same probe point', () => {
        const { reg } = setup('ground');
        reg.setState('door1', { open: true });
        expect(pointInsideEntityOnFloor(reg, 'ground', { x: 100, y: 100 })).toBe(false);
    });

    it('destroying the door clears collision', () => {
        const { reg } = setup('ground');
        reg.setState('door1', { destroyed: true });
        expect(pointInsideEntityOnFloor(reg, 'ground', { x: 100, y: 100 })).toBe(false);
    });

    it('a door on upper does not block ground queries', () => {
        const { reg } = setup('upper');
        expect(pointInsideEntityOnFloor(reg, 'ground', { x: 100, y: 100 })).toBe(false);
        expect(pointInsideEntityOnFloor(reg, 'upper', { x: 100, y: 100 })).toBe(true);
    });
});

describe('dynamicPhysics AABB collection', () => {
    it('returns world AABB for an axis-aligned door', () => {
        const { reg } = setup('ground');
        const boxes = collectEntityAABBs(reg, 'ground');
        expect(boxes).toHaveLength(1);
        expect(boxes[0]).toEqual({ x: 80, y: 95, w: 40, h: 10 });
    });

    it('omits opened entities', () => {
        const { reg } = setup('ground');
        reg.setState('door1', { open: true });
        expect(collectEntityAABBs(reg, 'ground')).toHaveLength(0);
    });
});
