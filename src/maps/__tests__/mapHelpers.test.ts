import { describe, it, expect, afterEach } from 'vitest';
import { getActiveMap, getActiveMapId, setActiveMap, MAP_LIST } from '@maps/helpers';

afterEach(() => {
    setActiveMap('arena');
});

describe('getActiveMap / getActiveMapId', () => {
    it('given default state, then getActiveMapId returns arena', () => {
        expect(getActiveMapId()).toBe('arena');
    });

    it('given default state, then getActiveMap returns a map with walls and teamSpawns', () => {
        const map = getActiveMap();
        expect(map.walls).toBeDefined();
        expect(map.teamSpawns).toBeDefined();
    });
});

describe('setActiveMap', () => {
    it('given valid id shipment, when setActiveMap called, then both id and map data change', () => {
        setActiveMap('shipment');
        expect(getActiveMapId()).toBe('shipment');
        expect(getActiveMap()).toBeDefined();
    });

    it('given invalid id, when setActiveMap called, then id remains unchanged', () => {
        setActiveMap('nonexistent');
        expect(getActiveMapId()).toBe('arena');
    });

    it('given shipment set then arena set, when queried, then returns arena', () => {
        setActiveMap('shipment');
        setActiveMap('arena');
        expect(getActiveMapId()).toBe('arena');
    });
});

describe('MAP_LIST', () => {
    it('given MAP_LIST, then contains exactly 2 entries', () => {
        expect(MAP_LIST).toHaveLength(2);
    });

    it('given MAP_LIST, then all entries have non-empty id, name, description, and data', () => {
        for (const entry of MAP_LIST) {
            expect(entry.id).toBeTruthy();
            expect(entry.name).toBeTruthy();
            expect(entry.description).toBeTruthy();
            expect(entry.data).toBeDefined();
        }
    });

    it('given MAP_LIST, then all ids are unique', () => {
        const ids = MAP_LIST.map(m => m.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
