/**
 * Per-kind serialised form for an item in the editor clipboard.
 *
 * Position fields stored relative to the bbox centre at copy time; on paste,
 * the centre is added back at the cursor position so the group lands as a
 * coherent shape.
 *
 * Part of the editor layer.
 */

import type {
    DecalPlacement,
    EntityPlacement,
    LightPlacement,
    NavHint,
    ObjectPlacement,
    Vec2,
    Wall,
    Zone,
} from '@shared/map/MapData';

import type { ItemKind } from '../state/EditorWorkingState';

export type SerializedItemData =
    | { kind: 'wall'; data: Omit<Wall, 'id'>; relative: Vec2 }
    | { kind: 'object'; data: Omit<ObjectPlacement, 'id'>; relative: Vec2 }
    | { kind: 'entity'; data: Omit<EntityPlacement, 'id'>; relative: Vec2 }
    | { kind: 'decal'; data: Omit<DecalPlacement, 'id'>; relative: Vec2 }
    | { kind: 'light'; data: Omit<LightPlacement, 'id'>; relative: Vec2 }
    | { kind: 'zone'; data: Omit<Zone, 'id'>; relative: Vec2 }
    | { kind: 'navHint'; data: Omit<NavHint, 'id'>; relative: Vec2 };

export type SerializedItem = SerializedItemData & {
    /** Original layer at copy time, if applicable. Resolved against current state on paste. */
    originalLayerId?: string;
};

export type ItemKindString = ItemKind;
