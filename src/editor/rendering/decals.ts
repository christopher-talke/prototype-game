/**
 * Editor-owned per-decal renderer.
 *
 * Renders a sprite (loaded from the decal's `assetPath`) at the decal's
 * position with rotation/scale/alpha. Falls back to a tinted placeholder
 * rectangle until the texture loads.
 *
 * Part of the editor layer.
 */

import { Container, Graphics, Sprite } from 'pixi.js';

import type { DecalPlacement } from '@shared/map/MapData';

import type { SpriteCache } from './spriteCache';

/** Build a Container holding the decal sprite and its hit area. */
export function buildDecalContainer(placement: DecalPlacement, cache: SpriteCache): Container {
    const c = new Container();
    c.label = placement.id;
    c.x = placement.position.x;
    c.y = placement.position.y;
    c.rotation = placement.rotation;
    c.scale.set(placement.scale.x, placement.scale.y);
    c.alpha = placement.alpha;

    const halfW = 16;
    const halfH = 16;

    const placeholder = new Graphics()
        .rect(-halfW, -halfH, halfW * 2, halfH * 2)
        .fill({ color: 0xa86eff, alpha: 0.18 });
    placeholder.label = 'placeholder';
    c.addChild(placeholder);

    const tex = cache.get(placement.assetPath);
    if (tex) {
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.5);
        c.addChild(s);
    } else {
        cache.load(placement.assetPath).catch(() => {});
    }

    c.eventMode = 'static';
    c.interactive = true;
    c.hitArea = { contains: (x, y) => x >= -halfW && y >= -halfH && x <= halfW && y <= halfH };
    return c;
}
