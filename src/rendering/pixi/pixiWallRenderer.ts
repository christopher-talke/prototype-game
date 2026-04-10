import { Container, Graphics } from 'pixi.js';
import { wallLayer } from './pixiSceneGraph';

const WALL_COLORS: Record<WallType, { fill: number; stroke: number }> = {
    concrete: { fill: 0x4a5568, stroke: 0x2d3748 },
    metal:    { fill: 0x374151, stroke: 0x1f2937 },
    crate:    { fill: 0x78450a, stroke: 0x4a2c06 },
    sandbag:  { fill: 0x8a7352, stroke: 0x5a4530 },
    barrier:  { fill: 0x5a6474, stroke: 0x3a4454 },
    pillar:   { fill: 0x3d4a5c, stroke: 0x2d3748 },
};

export function renderPixiWalls(walls: wall_info[]) {
    for (const wall of walls) {
        const colors = WALL_COLORS[wall.type ?? 'concrete'];
        const g = new Graphics();
        g.rect(0, 0, wall.width, wall.height)
            .fill(colors.fill)
            .rect(0, 0, wall.width, wall.height)
            .stroke({ color: colors.stroke, width: 1 });
        g.x = wall.x;
        g.y = wall.y;
        wallLayer.addChild(g);
    }
    // Bake all static wall geometry into a single texture
    (wallLayer as Container).cacheAsTexture(true);
}

export function clearPixiWalls() {
    (wallLayer as Container).cacheAsTexture(false);
    wallLayer.removeChildren();
}
