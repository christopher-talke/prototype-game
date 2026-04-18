/**
 * Zone type -> preview colour. Used by the editor Zone draw tool to render
 * the preview fill and by the renderer to tint committed zone overlays.
 *
 * Part of the shared render layer.
 */

import type { ZoneType } from '../map/MapData';

export interface ZoneColor {
    hex: number;
    css: string;
}

export const ZONE_COLORS: Record<ZoneType, ZoneColor> = {
    spawn: { hex: 0x3cd070, css: '#3cd070' },
    territory: { hex: 0xffb347, css: '#ffb347' },
    bombsite: { hex: 0xff4040, css: '#ff4040' },
    buyzone: { hex: 0x4aa3ff, css: '#4aa3ff' },
    trigger: { hex: 0xff3cdc, css: '#ff3cdc' },
    extract: { hex: 0xb8ff3c, css: '#b8ff3c' },
    audio: { hex: 0x9a70ff, css: '#9a70ff' },
    'floor-transition': { hex: 0xffe03c, css: '#ffe03c' },
};
