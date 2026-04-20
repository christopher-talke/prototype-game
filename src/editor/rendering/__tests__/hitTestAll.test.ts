/**
 * Tests for the pure `hitTestAllImpl` helper backing
 * `EditorMapRenderer.hitTestAll`. Exercises topmost-first ordering across
 * sublayers + children, hidden/locked filtering, and the no-hit path.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';

import type { MapData, Wall, DecalPlacement, LightPlacement } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { hitTestAllImpl } from '../editorMapRenderer';

function mkWall(id: string): Wall {
    return {
        id,
        vertices: [
            { x: 50, y: 50 },
            { x: 150, y: 50 },
            { x: 150, y: 150 },
            { x: 50, y: 150 },
        ],
        solid: true,
        bulletPenetrable: false,
        penetrationDecay: 0,
        audioOcclude: true,
        occludesVision: true,
        wallType: 'concrete',
    };
}

function mkDecal(id: string): DecalPlacement {
    return {
        id,
        assetPath: 'decals/test.png',
        position: { x: 100, y: 100 },
        rotation: 0,
        scale: { x: 4, y: 4 },
        alpha: 1,
        blendMode: 'normal',
    };
}

function mkLight(id: string): LightPlacement {
    return {
        id,
        position: { x: 100, y: 100 },
        color: { r: 255, g: 255, b: 255 },
        intensity: 1,
        radius: 60,
        coneAngle: 360,
        coneDirection: 0,
        castShadows: false,
    };
}

function seedStackedMap(): MapData {
    const map = createDefaultMapData();
    map.layers[0].walls.push(mkWall('wall-a'));
    map.layers[0].decals.push(mkDecal('decal-a'));
    map.layers[0].lights.push(mkLight('light-a'));
    return map;
}

function childWith(label: string): Container {
    const c = new Container();
    c.label = label;
    c.visible = true;
    c.eventMode = 'static';
    return c;
}

describe('hitTestAllImpl', () => {
    it('returns every hit topmost-first across three stacked sublayers', () => {
        const state = createWorkingState(seedStackedMap());

        const zone = new Container();
        const navHint = new Container();
        const light = new Container();
        const entity = new Container();
        const object = new Container();
        const wall = new Container();
        const decal = new Container();

        light.addChild(childWith('light-a'));
        wall.addChild(childWith('wall-a'));
        decal.addChild(childWith('decal-a'));

        const order = [zone, navHint, light, entity, object, wall, decal];

        const hits = hitTestAllImpl(state, order, 100, 100, () => false);
        expect(hits).toEqual(['light-a', 'wall-a', 'decal-a']);
    });

    it('returns an empty array when no item covers the point', () => {
        const state = createWorkingState(seedStackedMap());

        const wall = new Container();
        wall.addChild(childWith('wall-a'));
        const order = [new Container(), new Container(), new Container(), new Container(), new Container(), wall, new Container()];

        const hits = hitTestAllImpl(state, order, 9000, 9000, () => false);
        expect(hits).toEqual([]);
    });

    it('excludes hidden or locked items reported by the callback', () => {
        const state = createWorkingState(seedStackedMap());

        const light = new Container();
        const wall = new Container();
        const decal = new Container();

        light.addChild(childWith('light-a'));
        wall.addChild(childWith('wall-a'));
        decal.addChild(childWith('decal-a'));

        const order = [new Container(), new Container(), light, new Container(), new Container(), wall, decal];
        const hidden = new Set(['wall-a']);

        const hits = hitTestAllImpl(state, order, 100, 100, (g) => hidden.has(g));
        expect(hits).toEqual(['light-a', 'decal-a']);
    });

    it('walks children within a sublayer from highest index to lowest', () => {
        const state = createWorkingState(seedStackedMap());

        const decal = new Container();
        decal.addChild(childWith('wall-a'));
        decal.addChild(childWith('decal-a'));

        const order = [new Container(), new Container(), new Container(), new Container(), new Container(), new Container(), decal];

        const hits = hitTestAllImpl(state, order, 100, 100, () => false);
        expect(hits).toEqual(['decal-a', 'wall-a']);
    });

    it('skips children with no label or eventMode=none', () => {
        const state = createWorkingState(seedStackedMap());

        const wall = new Container();
        const muted = childWith('wall-a');
        muted.eventMode = 'none';
        wall.addChild(muted);

        const decal = new Container();
        const unlabelled = new Container();
        unlabelled.visible = true;
        unlabelled.eventMode = 'static';
        decal.addChild(unlabelled);
        decal.addChild(childWith('decal-a'));

        const order = [new Container(), new Container(), new Container(), new Container(), new Container(), wall, decal];

        const hits = hitTestAllImpl(state, order, 100, 100, () => false);
        expect(hits).toEqual(['decal-a']);
    });
});
