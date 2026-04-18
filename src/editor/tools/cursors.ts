/**
 * CSS cursor strings per tool / handle. Centralised so visuals stay consistent.
 *
 * Part of the editor layer.
 */

export const CURSORS = {
    select: 'default',
    move: 'move',
    grabbing: 'grabbing',
    crosshair: 'crosshair',
    rotate: 'crosshair',
    nwse: 'nwse-resize',
    nesw: 'nesw-resize',
    ns: 'ns-resize',
    ew: 'ew-resize',
} as const;

export type CursorName = keyof typeof CURSORS;
