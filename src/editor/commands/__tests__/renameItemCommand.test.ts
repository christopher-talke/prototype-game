/**
 * Tests for buildRenameItemCommand: writes to `label` on every placement kind,
 * round-trips through undo, no-ops on unknown guid or same-label writes.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import type {
    DecalPlacement,
    EntityPlacement,
    LightPlacement,
    MapData,
    NavHint,
    ObjectPlacement,
    Wall,
    Zone,
} from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildRenameItemCommand } from '../renameItemCommand';

function seed(map: MapData): void {
    const wall: Wall = {
        id: 'wall-1',
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
    const obj: ObjectPlacement = {
        id: 'obj-1',
        objectDefId: 'def',
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
    };
    const ent: EntityPlacement = {
        id: 'ent-1',
        entityTypeId: 'def',
        position: { x: 0, y: 0 },
        rotation: 0,
        initialState: {},
    };
    const decal: DecalPlacement = {
        id: 'decal-1',
        assetPath: '',
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        alpha: 1,
        blendMode: 'normal',
    };
    const light: LightPlacement = {
        id: 'light-1',
        position: { x: 0, y: 0 },
        color: { r: 255, g: 255, b: 255 },
        intensity: 1,
        radius: 100,
        coneAngle: Math.PI * 2,
        coneDirection: 0,
        castShadows: false,
    };
    const zone: Zone = {
        id: 'zone-1',
        type: 'trigger',
        label: 'Original Zone',
        polygon: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ],
        floorId: 'ground',
    };
    const nav: NavHint = {
        id: 'nav-1',
        type: 'cover',
        position: { x: 0, y: 0 },
        radius: 50,
        weight: 1,
    };
    map.layers[0].walls.push(wall);
    map.layers[0].objects.push(obj);
    map.layers[0].entities.push(ent);
    map.layers[0].decals.push(decal);
    map.layers[0].lights.push(light);
    map.zones.push(zone);
    map.navHints.push(nav);
}

function freshState() {
    const map = createDefaultMapData();
    seed(map);
    return createWorkingState(map);
}

const KINDS: Array<{ guid: string; newLabel: string }> = [
    { guid: 'wall-1', newLabel: 'North Fence' },
    { guid: 'obj-1', newLabel: 'Crate A' },
    { guid: 'ent-1', newLabel: 'Guard Bot' },
    { guid: 'decal-1', newLabel: 'Blood Splat' },
    { guid: 'light-1', newLabel: 'Corner Lamp' },
    { guid: 'zone-1', newLabel: 'Bombsite A' },
    { guid: 'nav-1', newLabel: 'West Choke' },
];

describe('buildRenameItemCommand', () => {
    for (const { guid, newLabel } of KINDS) {
        it(`renames ${guid} and round-trips through undo`, () => {
            const state = freshState();
            const cmd = buildRenameItemCommand(state, guid, newLabel);
            expect(cmd).not.toBe(null);
            cmd!.do(state);
            expect(state.byGUID.get(guid)?.name).toBe(newLabel);

            cmd!.undo(state);
            const refAfterUndo = state.byGUID.get(guid);
            expect(refAfterUndo).toBeDefined();
            expect(refAfterUndo!.name).not.toBe(newLabel);
        });
    }

    it('returns null when renaming to the same label', () => {
        const state = freshState();
        const first = buildRenameItemCommand(state, 'wall-1', 'North Fence');
        expect(first).not.toBe(null);
        first!.do(state);
        const second = buildRenameItemCommand(state, 'wall-1', 'North Fence');
        expect(second).toBe(null);
    });

    it('returns null for an unknown guid', () => {
        const state = freshState();
        expect(buildRenameItemCommand(state, 'does-not-exist', 'x')).toBe(null);
    });

    it('writes to the label field, not name', () => {
        const state = freshState();
        const cmd = buildRenameItemCommand(state, 'wall-1', 'North Fence');
        cmd!.do(state);
        const wall = state.map.layers[0].walls.find((w) => w.id === 'wall-1')!;
        expect(wall.label).toBe('North Fence');
        expect((wall as unknown as { name?: string }).name).toBeUndefined();
    });
});
