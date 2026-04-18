/**
 * Editor-owned per-zone renderer.
 *
 * Draws each zone polygon as a tinted fill + outline in a per-type colour.
 * A small label box sits at the polygon centroid. Zones span all floors
 * unless `floorId` is set; the editor renders only zones for the active floor
 * (filtering happens upstream in editorMapRenderer).
 *
 * Part of the editor layer.
 */

import { Container, Graphics, Polygon, Text } from 'pixi.js';

import type { Zone, ZoneType } from '@shared/map/MapData';

const ZONE_COLORS: Record<ZoneType, number> = {
    spawn: 0x66ffaa,
    territory: 0xffaa00,
    bombsite: 0xff5050,
    buyzone: 0x66ccff,
    trigger: 0xff66ff,
    extract: 0x00ff66,
    audio: 0xaaaaff,
    'floor-transition': 0xffff66,
};

/** Build a Container with the zone polygon, outline, and label. */
export function buildZoneContainer(zone: Zone): Container {
    const c = new Container();
    c.label = zone.id;
    if (zone.polygon.length < 3) return c;

    const color = ZONE_COLORS[zone.type] ?? 0xffffff;
    const points = zone.polygon.map((v) => ({ x: v.x, y: v.y }));

    const g = new Graphics();
    g.poly(points).fill({ color, alpha: 0.12 }).stroke({ color, width: 1.5, alpha: 0.85 });
    c.addChild(g);

    let cx = 0;
    let cy = 0;
    for (const v of zone.polygon) {
        cx += v.x;
        cy += v.y;
    }
    cx /= zone.polygon.length;
    cy /= zone.polygon.length;

    const label = new Text({
        text: zone.label || zone.type,
        style: {
            fill: color,
            fontFamily: 'sans-serif',
            fontSize: 11,
            fontWeight: '500',
            stroke: { color: 0x000000, width: 3 },
        },
    });
    label.anchor.set(0.5, 0.5);
    label.x = cx;
    label.y = cy;
    label.resolution = 2;
    c.addChild(label);

    c.hitArea = new Polygon(zone.polygon.flatMap((v) => [v.x, v.y]));
    c.eventMode = 'static';
    c.interactive = true;
    return c;
}
