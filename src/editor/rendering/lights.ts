/**
 * Editor-owned per-light renderer.
 *
 * Draws an iconographic representation of each light: a coloured filled circle
 * at the source position plus a faint cone wedge if the light has a directed
 * cone (coneAngle < TAU). Visualisation, not the actual lightmap.
 *
 * Part of the editor layer.
 */

import { Container, Graphics } from 'pixi.js';

import type { LightPlacement } from '@shared/map/MapData';

const ICON_RADIUS = 6;

/** Build a Container with a circle + optional cone wedge for the light. */
export function buildLightContainer(placement: LightPlacement): Container {
    const c = new Container();
    c.label = placement.id;
    c.x = placement.position.x;
    c.y = placement.position.y;

    const colorHex =
        ((placement.color.r & 0xff) << 16) |
        ((placement.color.g & 0xff) << 8) |
        (placement.color.b & 0xff);

    const g = new Graphics();
    if (placement.coneAngle > 0 && placement.coneAngle < Math.PI * 2) {
        const half = placement.coneAngle / 2;
        const dir = placement.coneDirection;
        g.moveTo(0, 0)
            .arc(0, 0, placement.radius, dir - half, dir + half)
            .lineTo(0, 0)
            .fill({ color: colorHex, alpha: 0.08 })
            .stroke({ color: colorHex, width: 1, alpha: 0.4 });
    } else {
        g.circle(0, 0, placement.radius).stroke({ color: colorHex, width: 1, alpha: 0.4 });
    }
    g.circle(0, 0, ICON_RADIUS).fill({ color: colorHex, alpha: 0.9 });
    c.addChild(g);

    c.eventMode = 'static';
    c.interactive = true;
    c.hitArea = {
        contains: (x, y) => x * x + y * y <= ICON_RADIUS * ICON_RADIUS,
    };
    return c;
}
