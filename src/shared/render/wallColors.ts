/**
 * Shared wall colour palette used by both the game canvas renderer and the
 * editor's per-item wall renderer.
 *
 * Part of the shared layer.
 */

import type { WallType } from '@shared/map/MapData';

export const WALL_COLORS: Record<WallType, { fill: number; stroke: number }> = {
    concrete: { fill: 0x4a5568, stroke: 0x2d3748 },
    metal:    { fill: 0x374151, stroke: 0x1f2937 },
    crate:    { fill: 0x78450a, stroke: 0x4a2c06 },
    sandbag:  { fill: 0x8a7352, stroke: 0x5a4530 },
    barrier:  { fill: 0x5a6474, stroke: 0x3a4454 },
    pillar:   { fill: 0x3d4a5c, stroke: 0x2d3748 },
};
