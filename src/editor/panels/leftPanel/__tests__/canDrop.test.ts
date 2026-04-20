/**
 * Tests for canDrop: the droppability matrix used by the drag-and-drop layer
 * to accept or reject a drop before dispatching a command.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import { canDrop, type DragMeta } from '../rowDragReorder';

function meta(guid: string, container: string, node: DragMeta['node']): DragMeta {
    return { guid, container, node };
}

describe('canDrop', () => {
    it('rejects dropping onto self', () => {
        const a = meta('a', 'array:l1:wall', 'item');
        expect(canDrop(a, a)).toBe(false);
    });

    it('accepts same-container item drops', () => {
        const a = meta('a', 'array:l1:wall', 'item');
        const b = meta('b', 'array:l1:wall', 'item');
        expect(canDrop(a, b)).toBe(true);
    });

    it('rejects cross-array item drops at root', () => {
        const wall = meta('a', 'array:l1:wall', 'item');
        const zone = meta('z1', 'zones:ground', 'item');
        expect(canDrop(wall, zone)).toBe(false);
    });

    it('accepts an item drop targeting a group container', () => {
        const item = meta('a', 'array:l1:wall', 'item');
        const groupTarget = meta('b', 'group:g1', 'item');
        expect(canDrop(item, groupTarget)).toBe(true);
    });

    it('accepts a group reparent drop into another group container', () => {
        const group = meta('gChild', 'group:gParent', 'group');
        const target = meta('b', 'group:gOther', 'item');
        expect(canDrop(group, target)).toBe(true);
    });

    it('layer rows only accept drops from the same layers-container', () => {
        const layerA = meta('la', 'layers:ground', 'layer');
        const layerB = meta('lb', 'layers:ground', 'layer');
        expect(canDrop(layerA, layerB)).toBe(true);
    });

    it('rejects cross-floor layer drops', () => {
        const layerGround = meta('lg', 'layers:ground', 'layer');
        const layerUp = meta('lu', 'layers:upstairs', 'layer');
        expect(canDrop(layerGround, layerUp)).toBe(false);
    });

    it('rejects layer source onto item target', () => {
        const layer = meta('la', 'layers:ground', 'layer');
        const item = meta('a', 'array:la:wall', 'item');
        expect(canDrop(layer, item)).toBe(false);
    });

    it('rejects item source onto a layer target', () => {
        const item = meta('a', 'array:l1:wall', 'item');
        const layer = meta('la', 'layers:ground', 'layer');
        expect(canDrop(item, layer)).toBe(false);
    });

    it('accepts drops within the same group container', () => {
        const a = meta('a', 'group:g1', 'item');
        const b = meta('b', 'group:g1', 'item');
        expect(canDrop(a, b)).toBe(true);
    });

    it('accepts drops from root into an item inside a group', () => {
        const root = meta('a', 'array:l1:wall', 'item');
        const grouped = meta('b', 'group:g1', 'item');
        expect(canDrop(root, grouped)).toBe(true);
    });

    it('rejects drops from group to an unrelated root array', () => {
        const grouped = meta('a', 'group:g1', 'item');
        const rootZone = meta('z1', 'zones:ground', 'item');
        expect(canDrop(grouped, rootZone)).toBe(false);
    });
});
