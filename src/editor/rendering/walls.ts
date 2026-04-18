/**
 * Editor-owned per-wall renderer.
 *
 * Unlike the game's batched wallRenderer (single cached texture), the editor
 * builds one Container per wall so each is hit-testable and styleable. Visual
 * style mirrors the game (shared WALL_COLORS) -- a fill, a top-left bevel
 * highlight, and a border stroke.
 *
 * Part of the editor layer.
 */

import { Container, Graphics, Polygon } from 'pixi.js';

import type { Wall } from '@shared/map/MapData';
import { WALL_COLORS } from '@shared/render/wallColors';

/** Build a Container with a Graphics child painting the wall polygon. */
export function buildWallContainer(wall: Wall): Container {
    const c = new Container();
    c.label = wall.id;

    const colors = WALL_COLORS[wall.wallType];
    const g = new Graphics();
    if (wall.vertices.length >= 3) {
        g.poly(wall.vertices.map((v) => ({ x: v.x, y: v.y }))).fill(colors.fill);
        g.poly(wall.vertices.map((v) => ({ x: v.x, y: v.y })))
            .stroke({ color: colors.stroke, width: 1.5 });
    }
    c.addChild(g);

    if (wall.vertices.length >= 3) {
        c.hitArea = new Polygon(wall.vertices.flatMap((v) => [v.x, v.y]));
    }
    c.eventMode = 'static';
    c.interactive = true;
    return c;
}
