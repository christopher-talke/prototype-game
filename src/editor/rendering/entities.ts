/**
 * Editor-owned per-entity renderer.
 *
 * Mirrors the object renderer but for entity placements; entities have no
 * scale field so the container scale stays at 1.
 *
 * Part of the editor layer.
 */

import { Container, Graphics, Sprite } from 'pixi.js';

import type { EntityPlacement, EntityTypeDefinition } from '@shared/map/MapData';

import type { SpriteCache } from './spriteCache';

const PLACEHOLDER_FILL = 0xffaa55;
const PLACEHOLDER_ALPHA = 0.25;
const PLACEHOLDER_STROKE = 0xffaa55;

/** Build a Container with sprites + a hit-area rectangle for the entity placement. */
export function buildEntityContainer(
    placement: EntityPlacement,
    def: EntityTypeDefinition | undefined,
    cache: SpriteCache,
): Container {
    const c = new Container();
    c.label = placement.id;
    c.x = placement.position.x;
    c.y = placement.position.y;
    c.rotation = placement.rotation;

    const halfW = def?.collisionShape?.type === 'aabb' ? def.collisionShape.width / 2 : 12;
    const halfH = def?.collisionShape?.type === 'aabb' ? def.collisionShape.height / 2 : 12;

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
