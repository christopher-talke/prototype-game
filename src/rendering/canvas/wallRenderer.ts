/**
 * Wall geometry renderer.
 *
 * Draws each wall as a filled rectangle with a top-left highlight bevel and
 * an outer border stroke. After all walls are drawn the wallLayer is baked
 * into a single cached texture for zero per-frame draw cost.
 *
 * Part of the canvas rendering layer.
 */

import { Container, Graphics } from 'pixi.js';

import { wallLayer } from './sceneGraph';

const WALL_COLORS: Record<WallType, { fill: number; stroke: number }> = {
    concrete: { fill: 0x4a5568, stroke: 0x2d3748 },
    metal:    { fill: 0x374151, stroke: 0x1f2937 },
    crate:    { fill: 0x78450a, stroke: 0x4a2c06 },
    sandbag:  { fill: 0x8a7352, stroke: 0x5a4530 },
    barrier:  { fill: 0x5a6474, stroke: 0x3a4454 },
    pillar:   { fill: 0x3d4a5c, stroke: 0x2d3748 },
};

/**
 * Render all wall geometry into the wall scene layer and cache the result as a texture.
 * Should be called once per map load.
 * @param walls - Wall definitions from the simulation environment.
 */
export function renderPixiWalls(walls: wall_info[]) {
    for (const wall of walls) {
        const colors = WALL_COLORS[wall.type ?? 'concrete'];
        const g = new Graphics();
        g.rect(0, 0, wall.width, wall.height).fill(colors.fill);
        const inset = 1.5;
        g.moveTo(inset, wall.height - inset)
            .lineTo(inset, inset)
            .lineTo(wall.width - inset, inset)
            .stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
        g.rect(0, 0, wall.width, wall.height)
            .stroke({ color: colors.stroke, width: 1.5 });
        g.x = wall.x;
        g.y = wall.y;
        wallLayer.addChild(g);
    }
    (wallLayer as Container).cacheAsTexture(true);
}

/** Remove all wall graphics and release the cached texture. */
export function clearPixiWalls() {
    (wallLayer as Container).cacheAsTexture(false);
    wallLayer.removeChildren();
}
