import { describe, it, expect } from 'vitest';
import type { MapData, MapLayer, Wall, ObjectDefinition } from '@shared/map/MapData';
import {
    compileWalls,
    compileObjectShapes,
    transformShape,
    shapeAABB,
    wallAABB,
} from '@orchestration/bootstrap/physicsCompiler';
import { ObjectDefRegistry } from '@orchestration/bootstrap/objectDefRegistry';

function makeWall(id: string, x: number, y: number, w: number, h: number): Wall {
    return {
        id,
        vertices: [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
        ],
        solid: true,
        bulletPenetrable: false,
        penetrationDecay: 0,
        audioOcclude: true,
        occludesVision: true,
        wallType: 'concrete',
    };
}

function makeLayer(id: string, floorId: string, type: MapLayer['type'], walls: Wall[] = []): MapLayer {
    return {
        id,
        floorId,
        type,
        label: id,
        locked: false,
        visible: true,
        walls,
        objects: [],
        entities: [],
        decals: [],
        lights: [],
    };
}

function baseMap(): MapData {
    return {
        meta: {
            id: 't',
            name: 'T',
            author: '',
            version: 1,
            thumbnail: '',
            gameModes: ['tdm'],
            playerCount: { min: 2, max: 10, recommended: 6 },
        },
        bounds: {
            width: 3000,
            height: 3000,
            playableArea: { x: 0, y: 0, width: 3000, height: 3000 },
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
        floors: [
            { id: 'ground', label: 'Ground', renderOrder: 0 },
            { id: 'upper', label: 'Upper', renderOrder: 1 },
        ],
        signals: [],
        layers: [],
        zones: [],
        navHints: [],
    };
}

describe('wallAABB', () => {
    it('computes the bounding box of a convex polygon', () => {
        const w = makeWall('w', 100, 200, 50, 80);
        expect(wallAABB(w)).toEqual({ x: 100, y: 200, w: 50, h: 80 });
    });

    it('handles non-axis-aligned polygons', () => {
        const w: Wall = {
            ...makeWall('w', 0, 0, 0, 0),
            vertices: [
                { x: 10, y: 20 },
                { x: 50, y: 10 },
                { x: 40, y: 60 },
            ],
        };
        expect(wallAABB(w)).toEqual({ x: 10, y: 10, w: 40, h: 50 });
    });
});

describe('compileWalls', () => {
    it('creates an empty hash for every declared floor', () => {
        const map = baseMap();
        const result = compileWalls(map);
        expect(result.has('ground')).toBe(true);
        expect(result.has('upper')).toBe(true);
        expect(result.get('ground')!.size()).toBe(0);
        expect(result.get('upper')!.size()).toBe(0);
    });

    it('isolates walls by floor -- cross-floor walls stay out of the wrong hash', () => {
        const map = baseMap();
        map.layers = [
            makeLayer('ground_collision', 'ground', 'collision', [makeWall('g1', 100, 100, 50, 50)]),
            makeLayer('upper_collision', 'upper', 'collision', [makeWall('u1', 100, 100, 50, 50)]),
        ];

        const result = compileWalls(map);
        const ground = result.get('ground')!;
        const upper = result.get('upper')!;

        expect(ground.size()).toBe(1);
        expect(upper.size()).toBe(1);

        const groundItems = Array.from(ground.all()).map((p) => p.wall.id);
        const upperItems = Array.from(upper.all()).map((p) => p.wall.id);
        expect(groundItems).toEqual(['g1']);
        expect(upperItems).toEqual(['u1']);
    });

    it('ignores floor/overhead/object layers for wall collision', () => {
        const map = baseMap();
        map.layers = [
            makeLayer('ground_floor', 'ground', 'floor', [makeWall('f1', 0, 0, 10, 10)]),
            makeLayer('ground_overhead', 'ground', 'overhead', [makeWall('o1', 0, 0, 10, 10)]),
            makeLayer('ground_object', 'ground', 'object', [makeWall('p1', 0, 0, 10, 10)]),
            makeLayer('ground_collision', 'ground', 'collision', [makeWall('c1', 0, 0, 10, 10)]),
        ];

        const result = compileWalls(map);
        const items = Array.from(result.get('ground')!.all()).map((p) => p.wall.id);
        expect(items).toEqual(['c1']);
    });

    it('includes ceiling-layer walls for collision (they block movement like walls)', () => {
        const map = baseMap();
        map.layers = [
            makeLayer('ground_ceiling', 'ground', 'ceiling', [makeWall('ce1', 0, 0, 10, 10)]),
        ];
        const result = compileWalls(map);
        const items = Array.from(result.get('ground')!.all()).map((p) => p.wall.id);
        expect(items).toEqual(['ce1']);
    });

    it('queryAABB returns only walls overlapping the query region', () => {
        const map = baseMap();
        map.layers = [
            makeLayer('ground_collision', 'ground', 'collision', [
                makeWall('near', 100, 100, 50, 50),
                makeWall('far', 2000, 2000, 50, 50),
            ]),
        ];

        const hash = compileWalls(map).get('ground')!;
        const out: Array<{ wall: Wall; aabb: { x: number; y: number; w: number; h: number } }> = [];
        hash.queryAABB({ x: 90, y: 90, w: 70, h: 70 }, out);
        expect(out.some((p) => p.wall.id === 'near')).toBe(true);
        expect(out.some((p) => p.wall.id === 'far')).toBe(false);
    });

    it('single-floor map produces the same wall set as a flat collect', () => {
        const map = baseMap();
        map.floors = [{ id: 'ground', label: 'Ground', renderOrder: 0 }];
        const wallList = [
            makeWall('a', 0, 0, 10, 10),
            makeWall('b', 500, 500, 20, 20),
            makeWall('c', 1000, 1000, 30, 30),
        ];
        map.layers = [makeLayer('c1', 'ground', 'collision', wallList)];

        const result = compileWalls(map);
        const ids = Array.from(result.get('ground')!.all()).map((p) => p.wall.id).sort();
        expect(ids).toEqual(['a', 'b', 'c']);
    });
});

describe('transformShape', () => {
    it('aabb at origin with no rotation/scale passes through unchanged', () => {
        const shape = transformShape(
            { type: 'aabb', x: 0, y: 0, width: 10, height: 20 },
            { x: 0, y: 0 },
            0,
            { x: 1, y: 1 },
        );
        expect(shape).toEqual({ type: 'aabb', x: 0, y: 0, width: 10, height: 20 });
    });

    it('aabb translated by placement position keeps its extent when unrotated', () => {
        const shape = transformShape(
            { type: 'aabb', x: 0, y: 0, width: 10, height: 20 },
            { x: 100, y: 100 },
            0,
            { x: 1, y: 1 },
        );
        expect(shape.type).toBe('aabb');
        if (shape.type !== 'aabb') return;
        expect(shape.x).toBeCloseTo(100);
        expect(shape.y).toBeCloseTo(100);
        expect(shape.width).toBeCloseTo(10);
        expect(shape.height).toBeCloseTo(20);
    });

    it('aabb rotated becomes a polygon with rotated world vertices', () => {
        // 10x10 box with local top-left at (0,0), placed at (100,100) rotated PI/2.
        // Local corners: (0,0),(10,0),(10,10),(0,10). Rotation PI/2: (x,y) -> (-y, x).
        // Rotated: (0,0),(0,10),(-10,10),(-10,0). Translated +100,100: (100,100),(100,110),(90,110),(90,100).
        const shape = transformShape(
            { type: 'aabb', x: 0, y: 0, width: 10, height: 10 },
            { x: 100, y: 100 },
            Math.PI / 2,
            { x: 1, y: 1 },
        );
        expect(shape.type).toBe('polygon');
        if (shape.type !== 'polygon') return;
        const aabb = shapeAABB(shape);
        expect(aabb.x).toBeCloseTo(90);
        expect(aabb.y).toBeCloseTo(100);
        expect(aabb.w).toBeCloseTo(10);
        expect(aabb.h).toBeCloseTo(10);
    });

    it('circle scale takes the larger of sx/sy', () => {
        const shape = transformShape(
            { type: 'circle', center: { x: 0, y: 0 }, radius: 10 },
            { x: 50, y: 50 },
            0,
            { x: 2, y: 3 },
        );
        expect(shape.type).toBe('circle');
        if (shape.type !== 'circle') return;
        expect(shape.radius).toBe(30);
        expect(shape.center).toEqual({ x: 50, y: 50 });
    });

    it('polygon vertices are rotated and translated', () => {
        const shape = transformShape(
            { type: 'polygon', vertices: [{ x: 10, y: 0 }, { x: 0, y: 10 }] },
            { x: 100, y: 100 },
            Math.PI / 2,
            { x: 1, y: 1 },
        );
        expect(shape.type).toBe('polygon');
        if (shape.type !== 'polygon') return;
        // (10, 0) rotated PI/2 -> (0, 10) + (100, 100) = (100, 110)
        // (0, 10) rotated PI/2 -> (-10, 0) + (100, 100) = (90, 100)
        expect(shape.vertices[0].x).toBeCloseTo(100);
        expect(shape.vertices[0].y).toBeCloseTo(110);
        expect(shape.vertices[1].x).toBeCloseTo(90);
        expect(shape.vertices[1].y).toBeCloseTo(100);
    });
});

describe('compileObjectShapes', () => {
    function crateDef(): ObjectDefinition {
        return {
            id: 'crate',
            label: 'Crate',
            collisionShape: { type: 'aabb', x: 0, y: 0, width: 40, height: 40 },
            lights: [],
            sprites: [],
            pivot: { x: 0, y: 0 },
        };
    }

    function signDef(): ObjectDefinition {
        return {
            id: 'sign',
            label: 'Sign',
            collisionShape: null,
            lights: [],
            sprites: [],
            pivot: { x: 0, y: 0 },
        };
    }

    it('skips placements whose def has no collision shape', () => {
        const map = baseMap();
        map.objectDefs = [signDef()];
        map.layers = [
            {
                ...makeLayer('ground_object', 'ground', 'object'),
                objects: [
                    { id: 'p1', objectDefId: 'sign', position: { x: 100, y: 100 }, rotation: 0, scale: { x: 1, y: 1 } },
                ],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const result = compileObjectShapes(map, reg);
        expect(result.get('ground')!.size()).toBe(0);
    });

    it('emits placed shapes into the correct floor hash', () => {
        const map = baseMap();
        map.objectDefs = [crateDef()];
        map.layers = [
            {
                ...makeLayer('ground_object', 'ground', 'object'),
                objects: [
                    { id: 'gp', objectDefId: 'crate', position: { x: 200, y: 200 }, rotation: 0, scale: { x: 1, y: 1 } },
                ],
            },
            {
                ...makeLayer('upper_object', 'upper', 'object'),
                objects: [
                    { id: 'up', objectDefId: 'crate', position: { x: 400, y: 400 }, rotation: 0, scale: { x: 1, y: 1 } },
                ],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const result = compileObjectShapes(map, reg);
        expect(result.get('ground')!.size()).toBe(1);
        expect(result.get('upper')!.size()).toBe(1);
        expect(Array.from(result.get('ground')!.all())[0].placementId).toBe('gp');
        expect(Array.from(result.get('upper')!.all())[0].placementId).toBe('up');
    });

    it('cross-floor isolation: a query for ground walls never sees upper-floor objects', () => {
        const map = baseMap();
        map.objectDefs = [crateDef()];
        map.layers = [
            {
                ...makeLayer('ground_object', 'ground', 'object'),
                objects: [
                    { id: 'gp', objectDefId: 'crate', position: { x: 200, y: 200 }, rotation: 0, scale: { x: 1, y: 1 } },
                ],
            },
            {
                ...makeLayer('upper_object', 'upper', 'object'),
                objects: [
                    { id: 'up', objectDefId: 'crate', position: { x: 200, y: 200 }, rotation: 0, scale: { x: 1, y: 1 } },
                ],
            },
        ];
        const reg = new ObjectDefRegistry(map.objectDefs);
        const result = compileObjectShapes(map, reg);

        const out: Array<{ placementId: string }> = [];
        result.get('ground')!.queryAABB({ x: 0, y: 0, w: 1000, h: 1000 }, out);
        expect(out.every((s) => s.placementId === 'gp')).toBe(true);
    });
});

describe('ObjectDefRegistry', () => {
    it('resolves local defs by id', () => {
        const reg = new ObjectDefRegistry([
            {
                id: 'crate',
                label: 'Crate',
                collisionShape: null,
                lights: [],
                sprites: [],
                pivot: { x: 0, y: 0 },
            },
        ]);
        expect(reg.resolve('crate').id).toBe('crate');
        expect(reg.has('crate')).toBe(true);
    });

    it('throws on unresolved ids', () => {
        const reg = new ObjectDefRegistry([]);
        expect(() => reg.resolve('missing')).toThrow(/missing/);
    });
});
