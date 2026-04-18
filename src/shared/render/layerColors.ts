/**
 * Shared layer colour palette for the editor's structure browser, drag ghosts,
 * layer badges, and any other UI that needs to associate a colour with a
 * map layer type.
 *
 * Part of the shared layer.
 */

import type { LayerType } from '@shared/map/MapData';

export const LAYER_COLORS: Record<LayerType, { hex: number; css: string; badge: string }> = {
    floor:     { hex: 0xd4a574, css: '#d4a574', badge: 'FLR' },
    collision: { hex: 0xff5050, css: '#ff5050', badge: 'COL' },
    object:    { hex: 0x00e5ff, css: '#00e5ff', badge: 'OBJ' },
    overhead:  { hex: 0xa86eff, css: '#a86eff', badge: 'OVH' },
    ceiling:   { hex: 0x6a6a7e, css: '#6a6a7e', badge: 'CEI' },
};
