import { describe, it, expect } from 'vitest';
import type { MapData, MapLayer, EntityTypeDefinition, EntityPlacement } from '@shared/map/MapData';
import { EntityRegistry } from '@simulation/entities/entityRegistry';
import { EntityDefRegistry } from '@orchestration/bootstrap/entityDefRegistry';

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
        floors: [{ id: 'ground', label: 'G', renderOrder: 0 }],
        signals: [],
        layers: [],
        zones: [],
        navHints: [],
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
        initialState: { open: false, locked: false },
        sprites: [],
        lights: [],
    };
}

function doorPlacement(id: string, x: number, y: number, overrides: Record<string, unknown> = {}): EntityPlacement {
    return { id, entityTypeId: 'door', position: { x, y }, rotation: 0, initialState: overrides };
}

describe('EntityRegistry initialState merge', () => {
    it('type defaults merge with placement overrides taking precedence', () => {
        const map = baseMap();
        map.entityDefs = [doorDef()];
        map.layers = [
            { ...emptyLayer('l', 'ground'), entities: [doorPlacement('d1', 0, 0, { locked: true })] },
        ];
        const reg = EntityRegistry.fromMap(map, new EntityDefRegistry(map.entityDefs));
        const d1 = reg.get('d1')!;
        expect(d1.state.open).toBe(false);
        expect(d1.state.locked).toBe(true);
    });

    it('placement can override a type default', () => {
        const map = baseMap();
        map.entityDefs = [doorDef()];
        map.layers = [
            { ...emptyLayer('l', 'ground'), entities: [doorPlacement('d1', 0, 0, { open: true })] },
        ];
        const reg = EntityRegistry.fromMap(map, new EntityDefRegistry(map.entityDefs));
        expect(reg.get('d1')!.state.open).toBe(true);
    });
});

describe('EntityRegistry floor indexing', () => {
    it('separates entities by containing layer floorId', () => {
        const map = baseMap();
        map.entityDefs = [doorDef()];
        map.floors = [
            { id: 'ground', label: 'G', renderOrder: 0 },
            { id: 'upper', label: 'U', renderOrder: 1 },
        ];
        map.layers = [
            { ...emptyLayer('gl', 'ground'), entities: [doorPlacement('gd', 0, 0)] },
            { ...emptyLayer('ul', 'upper'), entities: [doorPlacement('ud', 0, 0)] },
        ];
        const reg = EntityRegistry.fromMap(map, new EntityDefRegistry(map.entityDefs));
        expect(reg.getByFloor('ground').map((e) => e.id)).toEqual(['gd']);
        expect(reg.getByFloor('upper').map((e) => e.id)).toEqual(['ud']);
    });
});

describe('EntityRegistry.setState event diffing', () => {
    it('returns ENTITY_STATE_CHANGED with correct changedFields when state changes', () => {
        const map = baseMap();
        map.entityDefs = [doorDef()];
        map.layers = [{ ...emptyLayer('l', 'ground'), entities: [doorPlacement('d1', 0, 0)] }];
        const reg = EntityRegistry.fromMap(map, new EntityDefRegistry(map.entityDefs));
        const ev = reg.setState('d1', { open: true });
        expect(ev).not.toBeNull();
        expect(ev!.type).toBe('ENTITY_STATE_CHANGED');
        expect(ev!.entityId).toBe('d1');
        expect(ev!.changedFields).toEqual(['open']);
        expect(ev!.prevState.open).toBe(false);
        expect(ev!.newState.open).toBe(true);
    });

    it('returns null when patch introduces no actual change', () => {
        const map = baseMap();
        map.entityDefs = [doorDef()];
        map.layers = [{ ...emptyLayer('l', 'ground'), entities: [doorPlacement('d1', 0, 0)] }];
        const reg = EntityRegistry.fromMap(map, new EntityDefRegistry(map.entityDefs));
        expect(reg.setState('d1', { open: false })).toBeNull();
    });

    it('returns null for unknown entity id', () => {
        const reg = new EntityRegistry();
        expect(reg.setState('ghost', { x: 1 })).toBeNull();
    });
});
