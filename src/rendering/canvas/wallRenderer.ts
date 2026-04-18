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

import type { Wall } from '@shared/map/MapData';
import { wallAABB } from '@orchestration/bootstrap/mapAccessors';
import { WALL_COLORS } from '@shared/render/wallColors';
import { wallLayer } from './sceneGraph';

/**
 * Render all wall geometry into the wall scene layer and cache the result as a texture.
 * Should be called once per map load.
 * @param walls - Wall definitions from the map config.
 */
export function renderPixiWalls(walls: Wall[]) {
    for (const wall of walls) {
        const colors = WALL_COLORS[wall.wallType];
        const aabb = wallAABB(wall);
        const g = new Graphics();
        g.rect(0, 0, aabb.width, aabb.height).fill(colors.fill);
        const inset = 1.5;
        g.moveTo(inset, aabb.height - inset)
            .lineTo(inset, inset)
            .lineTo(aabb.width - inset, inset)
            .stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
        g.rect(0, 0, aabb.width, aabb.height)
            .stroke({ color: colors.stroke, width: 1.5 });
        g.x = aabb.x;
        g.y = aabb.y;
        wallLayer.addChild(g);
    }
    (wallLayer as Container).cacheAsTexture(true);
}

/** Remove all wall graphics and release the cached texture. */
export function clearPixiWalls() {
    (wallLayer as Container).cacheAsTexture(false);
    wallLayer.removeChildren();
}
