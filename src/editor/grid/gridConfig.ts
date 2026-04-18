/**
 * Grid density tiers + rendering constants.
 *
 * Zoom ranges (inclusive of the low end) map to a unit size. Neighbouring
 * tiers cross-fade across a 15% transition band at each boundary so the
 * visual change is smooth, not popping.
 *
 * Part of the editor layer.
 */

export interface GridTier {
    minZoom: number;
    maxZoom: number;
    unit: number;
    showMinor: boolean;
}

export const GRID_TIERS: GridTier[] = [
    { minZoom: 0.05, maxZoom: 0.15, unit: 256, showMinor: false },
    { minZoom: 0.15, maxZoom: 0.5, unit: 64, showMinor: true },
    { minZoom: 0.5, maxZoom: 2, unit: 16, showMinor: true },
    { minZoom: 2, maxZoom: 8, unit: 4, showMinor: true },
    { minZoom: 8, maxZoom: 32, unit: 1, showMinor: true },
];

/** Fraction of the tier span (on each side of a boundary) used for cross-fade. */
export const TRANSITION_BAND = 0.15;

/** Minor line colour (below major). */
export const GRID_MINOR_COLOR = 0x2a2a36;
/** Major line colour (brighter). */
export const GRID_MAJOR_COLOR = 0x3e3e52;

/** Major-line spacing as a multiple of the tier unit. */
export const MAJOR_EVERY = 4;

/** Line width in screen pixels. Drawn in world space so we divide by zoom. */
export const GRID_LINE_PX = 1;
