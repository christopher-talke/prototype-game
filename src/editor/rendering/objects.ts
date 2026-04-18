/**
 * Editor-owned per-object renderer.
 *
 * Builds one Container per object placement. Sprites load asynchronously via
 * SpriteCache. While a sprite is pending, a placeholder rectangle is drawn so
 * the item is still selectable.
 *
 * Part of the editor layer.
 */

import { Container, Graphics, Sprite } from 'pixi.js';

import type { ObjectDefinition, ObjectPlacement } from '@shared/map/MapData';

import type { SpriteCache } from './spriteCache';

const PLACEHOLDER_FILL = 0x00e5ff;
const PLACEHOLDER_ALPHA = 0.25;
const PLACEHOLDER_STROKE = 0x00e5ff;

/** Build a Container with sprites + a hit-area rectangle for the object placement. */
export function buildObjectContainer(
    placement: ObjectPlacement,
    def: ObjectDefinition | undefined,
    cache: SpriteCache,
): Container {
    const c = new Container();
    c.label = placement.id;
    c.x = placement.position.x;
    c.y = placement.position.y;
    c.rotation = placement.rotation;
    c.scale.set(placement.scale.x, placement.scale.y);

    const halfW = def?.collisionShape?.type === 'aabb' ? def.collisionShape.width / 2 : 16;
    const halfH = def?.collisionShape?.type === 'aabb' ? def.collisionShape.height / 2 : 16;

    const placeholder = new Graphics()
        .rect(-halfW, -halfH, halfW * 2, halfH * 2)
        .fill({ color: PLACEHOLDER_FILL, alpha: PLACEHOLDER_ALPHA })
        .stroke({ color: PLACEHOLDER_STROKE, width: 1, alpha: 0.6 });
    placeholder.label = 'placeholder';
    c.addChild(placeholder);

    if (def) {
        for (const layer of def.sprites) {
            const tex = cache.get(layer.assetPath);
            if (!tex) {
                cache.load(layer.assetPath).catch(() => {});
                continue;
            }
            const s = new Sprite(tex);
            s.anchor.set(0.5, 0.5);
            s.x = layer.offset.x;
            s.y = layer.offset.y;
            s.alpha = layer.alpha;
            c.addChild(s);
        }
    }

    c.eventMode = 'static';
    c.interactive = true;
    c.hitArea = { contains: (x, y) => x >= -halfW && y >= -halfH && x <= halfW && y <= halfH };
    return c;
}
