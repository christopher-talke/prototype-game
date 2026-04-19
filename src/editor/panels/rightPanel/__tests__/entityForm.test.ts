import { describe, it, expect } from 'vitest';

import type { EntityPlacement, EntityTypeDefinition, MapData } from '@shared/map/MapData';

import { CommandStack } from '../../../commands/CommandStack';
import { createDefaultMapData } from '../../../state/defaultMap';
import { createWorkingState } from '../../../state/EditorWorkingState';
import { entityFormFields } from '../forms/entityForm';

const DEF_ID = 'def-1';
const ENT_ID = 'ent-1';

function mkDef(schema: EntityTypeDefinition['stateSchema']): EntityTypeDefinition {
    return {
        id: DEF_ID,
        label: 'Test Entity',
        collisionShape: null,
        interactionRadius: 0,
        initialState: {},
        stateSchema: schema,
        sprites: [],
        lights: [],
    };
}

function mkPlacement(initialState: Record<string, unknown>): EntityPlacement & { name: string } {
    return {
        id: ENT_ID,
        name: 'Entity 1',
        entityTypeId: DEF_ID,
        position: { x: 0, y: 0 },
        rotation: 0,
        initialState,
    };
}

function mkMap(schema: EntityTypeDefinition['stateSchema'], initialState: Record<string, unknown>): MapData {
    const map = createDefaultMapData();
    map.entityDefs.push(mkDef(schema));
    map.layers[0].entities.push(mkPlacement(initialState));
    return map;
}

function getEnt(state: ReturnType<typeof createWorkingState>): EntityPlacement {
    return state.map.layers[0].entities[0] as EntityPlacement;
}

describe('entityFormFields - rich state editors', () => {
    it('emits a color descriptor for type: color', () => {
        const map = mkMap({ tint: { type: 'color' } }, { tint: { r: 10, g: 20, b: 30 } });
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));

        const f = fields.find((x) => x.key === 'tint');
        expect(f).toBeDefined();
        expect(f!.type).toBe('color');
        const cf = f as Extract<typeof f, { type: 'color' }>;
        expect(cf.value).toEqual({ r: 10, g: 20, b: 30 });

        cf.onCommit({ r: 255, g: 0, b: 128 });
        expect(getEnt(state).initialState.tint).toEqual({ r: 255, g: 0, b: 128 });
    });

    it('falls back to {0,0,0} when color value is missing/wrong-typed', () => {
        const map = mkMap({ tint: { type: 'color' } }, {});
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));
        const f = fields.find((x) => x.key === 'tint') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'color' }
        >;
        expect(f.value).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('emits a range descriptor with min/max/step for type: range', () => {
        const map = mkMap(
            { volume: { type: 'range', min: 0, max: 1, step: 0.1 } },
            { volume: 0.5 },
        );
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));

        const f = fields.find((x) => x.key === 'volume') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'range' }
        >;
        expect(f.type).toBe('range');
        expect(f.value).toBe(0.5);
        expect(f.min).toBe(0);
        expect(f.max).toBe(1);
        expect(f.step).toBe(0.1);

        f.onCommit(0.75);
        expect(getEnt(state).initialState.volume).toBe(0.75);
    });

    it('falls back to descriptor.min when range value is not a number', () => {
        const map = mkMap(
            { volume: { type: 'range', min: 5, max: 10 } },
            { volume: 'broken' },
        );
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));
        const f = fields.find((x) => x.key === 'volume') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'range' }
        >;
        expect(f.value).toBe(5);
    });

    it('emits a nested descriptor and commits inner edits at the nested path', () => {
        const map = mkMap(
            {
                outer: {
                    type: 'nested',
                    fields: { inner: { type: 'primitive' } },
                },
            },
            { outer: { inner: 42 } },
        );
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));

        const outer = fields.find((x) => x.key === 'outer') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'nested' }
        >;
        expect(outer.type).toBe('nested');
        expect(outer.fields).toHaveLength(1);

        const inner = outer.fields[0] as Extract<typeof outer.fields[number], { type: 'number' }>;
        expect(inner.type).toBe('number');
        expect(inner.value).toBe(42);

        inner.onCommit(100);
        expect(getEnt(state).initialState.outer).toEqual({ inner: 100 });

        stack.undo();
        expect(getEnt(state).initialState.outer).toEqual({ inner: 42 });
    });

    it('emits an array descriptor with per-element items and onAdd/onRemove', () => {
        const map = mkMap(
            { tags: { type: 'array', element: { type: 'primitive' } } },
            { tags: ['a', 'b'] },
        );
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));

        const arr = fields.find((x) => x.key === 'tags') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'array' }
        >;
        expect(arr.type).toBe('array');
        expect(arr.items).toHaveLength(2);

        const item0 = arr.items[0] as Extract<typeof arr.items[number], { type: 'text' }>;
        expect(item0.type).toBe('text');
        expect(item0.value).toBe('a');

        item0.onCommit('aa');
        expect(getEnt(state).initialState.tags).toEqual(['aa', 'b']);

        arr.onAdd();
        expect(getEnt(state).initialState.tags).toEqual(['aa', 'b', 0]);

        arr.onRemove(1);
        expect(getEnt(state).initialState.tags).toEqual(['aa', 0]);

        stack.undo();
        expect(getEnt(state).initialState.tags).toEqual(['aa', 'b', 0]);
    });

    it('handles array-of-nested deep edits', () => {
        const map = mkMap(
            {
                items: {
                    type: 'array',
                    element: {
                        type: 'nested',
                        fields: { name: { type: 'primitive' } },
                    },
                },
            },
            { items: [{ name: 'x' }, { name: 'y' }, { name: 'z' }] },
        );
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));

        const arr = fields.find((x) => x.key === 'items') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'array' }
        >;
        const second = arr.items[1] as Extract<typeof arr.items[number], { type: 'nested' }>;
        const nameField = second.fields[0] as Extract<
            typeof second.fields[number],
            { type: 'text' }
        >;
        nameField.onCommit('yy');
        expect(getEnt(state).initialState.items).toEqual([
            { name: 'x' },
            { name: 'yy' },
            { name: 'z' },
        ]);
    });

    it('onAdd uses defaultForEntityStateDescriptor for the element type', () => {
        const map = mkMap(
            {
                colors: { type: 'array', element: { type: 'color' } },
                ranges: { type: 'array', element: { type: 'range', min: 7, max: 10 } },
                pairs: {
                    type: 'array',
                    element: {
                        type: 'nested',
                        fields: { k: { type: 'primitive' } },
                    },
                },
            },
            { colors: [], ranges: [], pairs: [] },
        );
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));

        const colors = fields.find((x) => x.key === 'colors') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'array' }
        >;
        const ranges = fields.find((x) => x.key === 'ranges') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'array' }
        >;
        const pairs = fields.find((x) => x.key === 'pairs') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'array' }
        >;

        colors.onAdd();
        ranges.onAdd();
        pairs.onAdd();
        expect(getEnt(state).initialState.colors).toEqual([{ r: 0, g: 0, b: 0 }]);
        expect(getEnt(state).initialState.ranges).toEqual([7]);
        expect(getEnt(state).initialState.pairs).toEqual([{ k: 0 }]);
    });

    it('keeps existing primitive/layerId/entityId/teamId/signalId behaviour', () => {
        const map = mkMap(
            {
                count: { type: 'primitive' },
                lane: { type: 'teamId' },
            },
            { count: 3, lane: 'red' },
        );
        const state = createWorkingState(map);
        const stack = new CommandStack(state);
        const fields = entityFormFields(state, stack, getEnt(state));

        const count = fields.find((x) => x.key === 'count') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'number' }
        >;
        expect(count.type).toBe('number');
        expect(count.value).toBe(3);

        const lane = fields.find((x) => x.key === 'lane') as Extract<
            ReturnType<typeof entityFormFields>[number],
            { type: 'text' }
        >;
        expect(lane.type).toBe('text');
        expect(lane.value).toBe('red');
    });
});
