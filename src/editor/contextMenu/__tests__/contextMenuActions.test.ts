/**
 * Tests for the context-menu factory helpers: Select-From-Here submenu
 * construction and the optional prepend behaviour on the item/empty menus.
 *
 * Part of the editor layer.
 */

import { describe, it, expect, vi } from 'vitest';

import type { MapData, Wall } from '@shared/map/MapData';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { SelectionStore } from '../../selection/selectionStore';
import type { EditorActions } from '../contextMenuActions';
import {
    buildSelectFromHereSubmenu,
    itemMenu,
    emptyMenu,
} from '../contextMenuActions';

function mkWall(id: string, label?: string): Wall {
    return {
        id,
        label,
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
}

function seedMap(): MapData {
    const map = createDefaultMapData();
    map.layers[0].walls.push(mkWall('wall-a', 'Alpha Wall'));
    map.layers[0].walls.push(mkWall('wall-b', 'Beta Wall'));
    return map;
}

function noopActions(): EditorActions {
    return {
        cut: vi.fn(),
        copy: vi.fn(),
        paste: vi.fn(),
        duplicate: vi.fn(),
        deleteSelection: vi.fn(),
        selectAll: vi.fn(),
        moveToLayer: vi.fn(),
        toggleLayerLock: vi.fn(),
        openProperties: vi.fn(),
    };
}

describe('buildSelectFromHereSubmenu', () => {
    it('returns one MenuItem per hit with kind badge + display name', () => {
        const state = createWorkingState(seedMap());
        const selection = new SelectionStore();
        const hits = ['wall-a', 'wall-b'];

        const items = buildSelectFromHereSubmenu(state, selection, hits);
        expect(items.length).toBe(2);
        expect(items[0].label).toBe('W  Alpha Wall');
        expect(items[1].label).toBe('W  Beta Wall');
    });

    it('clicking a submenu item selects that guid', () => {
        const state = createWorkingState(seedMap());
        const selection = new SelectionStore();
        const items = buildSelectFromHereSubmenu(state, selection, ['wall-b']);

        items[0].onClick!();
        expect(selection.has('wall-b')).toBe(true);
        expect(selection.size()).toBe(1);
    });

    it('skips unknown guids', () => {
        const state = createWorkingState(seedMap());
        const selection = new SelectionStore();
        const items = buildSelectFromHereSubmenu(state, selection, ['wall-a', 'not-a-guid']);
        expect(items.length).toBe(1);
        expect(items[0].label).toBe('W  Alpha Wall');
    });
});

describe('itemMenu / emptyMenu with Select-From-Here', () => {
    it('itemMenu prepends Select From Here + separator when submenu non-empty', () => {
        const state = createWorkingState(seedMap());
        const selection = new SelectionStore();
        selection.select('wall-a');
        const submenu = buildSelectFromHereSubmenu(state, selection, ['wall-a', 'wall-b']);

        const menu = itemMenu(state, selection, noopActions(), { x: 0, y: 0 }, submenu);
        expect(menu[0].label).toBe('Select From Here');
        expect(menu[0].submenu!.length).toBe(2);
        expect(menu[1].separator).toBe(true);
        expect(menu[2].label).toBe('Cut');
    });

    it('itemMenu without submenu starts with Cut as before', () => {
        const state = createWorkingState(seedMap());
        const selection = new SelectionStore();
        selection.select('wall-a');

        const menu = itemMenu(state, selection, noopActions(), { x: 0, y: 0 });
        expect(menu[0].label).toBe('Cut');
    });

    it('emptyMenu prepends Select From Here + separator when submenu non-empty', () => {
        const state = createWorkingState(seedMap());
        const selection = new SelectionStore();
        const submenu = buildSelectFromHereSubmenu(state, selection, ['wall-a']);

        const menu = emptyMenu(noopActions(), { x: 0, y: 0 }, submenu);
        expect(menu[0].label).toBe('Select From Here');
        expect(menu[1].separator).toBe(true);
        expect(menu[2].label).toBe('Paste');
    });

    it('emptyMenu without submenu starts with Paste as before', () => {
        const menu = emptyMenu(noopActions(), { x: 0, y: 0 });
        expect(menu[0].label).toBe('Paste');
    });

    it('emptyMenu with empty hits array does not prepend', () => {
        const menu = emptyMenu(noopActions(), { x: 0, y: 0 }, []);
        expect(menu[0].label).toBe('Paste');
    });
});
