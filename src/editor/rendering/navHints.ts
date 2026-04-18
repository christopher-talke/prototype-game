/**
 * Editor-owned per-navHint renderer.
 *
 * Each hint is shown as a small ring (radius scaled to `radius`) plus a label
 * with its type. NavHints float above all floors (no per-floor filtering).
 *
 * Part of the editor layer.
 */

import { Container, Graphics, Text } from 'pixi.js';

import type { NavHint, NavHintType } from '@shared/map/MapData';

const HINT_COLORS: Record<NavHintType, number> = {
    cover: 0x66ccff,
    choke: 0xff8844,
    flank: 0xaa66ff,
    danger: 0xff5050,
    objective: 0xffd24a,
};

/** Build a Container holding the navHint ring, dot, and type label. */
export function buildNavHintContainer(hint: NavHint): Container {
    const c = new Container();
    c.label = hint.id;
    c.x = hint.position.x;
    c.y = hint.position.y;

    const color = HINT_COLORS[hint.type] ?? 0xffffff;
    const radius = Math.max(hint.radius, 8);

    const g = new Graphics();
    g.circle(0, 0, radius).stroke({ color, width: 1, alpha: 0.7 });
    g.circle(0, 0, 3).fill(color);
    c.addChild(g);

    const label = new Text({
        text: hint.type,
        style: {
            fill: color,
            fontFamily: 'sans-serif',
            fontSize: 10,
            stroke: { color: 0x000000, width: 3 },
        },
    });
    label.anchor.set(0.5, 0);
    label.y = radius + 2;
    label.resolution = 2;
    c.addChild(label);

    c.eventMode = 'static';
    c.interactive = true;
    c.hitArea = { contains: (x, y) => x * x + y * y <= radius * radius };
    return c;
}
