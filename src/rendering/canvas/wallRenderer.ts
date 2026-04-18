/**
 * Wall geometry renderer.
 *
 * Draws each wall as a filled polygon with a border stroke using the wall's
 * full vertex list. After all walls are drawn the wallLayer is baked into a
 * single cached texture for zero per-frame draw cost.
 *
 * Part of the canvas rendering layer.
 */

import { Container, Graphics } from 'pixi.js';

import type { Wall } from '@shared/map/MapData';
import { WALL_COLORS } from '@shared/render/wallColors';
import { wallLayer } from './sceneGraph';

/**
 * Render all wall geometry into the wall scene layer and cache the result as a texture.
 * Should be called once per map load.
 * @param walls - Wall definitions from the map config.
 */
export function renderPixiWalls(walls: Wall[]) {
    for (const wall of walls) {
        if (wall.vertices.length < 3) continue;
        const colors = WALL_COLORS[wall.wallType];
        const points = wall.vertices.map((v) => ({ x: v.x, y: v.y }));
        const g = new Graphics();
        g.poly(points).fill(colors.fill);
        g.poly(points).stroke({ color: colors.stroke, width: 1.5 });
        wallLayer.addChild(g);
    }
    (wallLayer as Container).cacheAsTexture(true);
}

/** Remove all wall graphics and release the cached texture. */
export function clearPixiWalls() {
    (wallLayer as Container).cacheAsTexture(false);
    wallLayer.removeChildren();
}
