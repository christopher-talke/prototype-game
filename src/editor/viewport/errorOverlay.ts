/**
 * Viewport error overlay. Draws a 2px red outline around items that have
 * compile errors. Persists until the next compile run clears it.
 *
 * Only renders items on the currently active floor.
 *
 * Part of the editor layer.
 */

import { Graphics, type Container } from 'pixi.js';

import type { CompileError } from '../compile/mapCompiler';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { boundsOfGUID } from '../selection/boundsOf';

const ERROR_COLOR = 0xff3030;
const ERROR_ALPHA = 0.9;
const LINE_WIDTH = 2;
const PADDING = 3;

export class ErrorOverlay {
    private readonly g: Graphics;

    constructor(parent: Container) {
        this.g = new Graphics();
        this.g.label = 'editor.errorOverlay';
        parent.addChild(this.g);
    }

    rebuild(
        errors: CompileError[],
        state: EditorWorkingState,
        activeFloorId: string,
    ): void {
        this.g.clear();
        if (errors.length === 0) return;

        const drawn = new Set<string>();

        for (const error of errors) {
            const guid = error.itemGUID;
            if (!guid || drawn.has(guid)) continue;

            const ref = state.byGUID.get(guid);
            if (!ref) continue;

            const itemFloor = ref.floorId
                ?? (ref.kind === 'zone'
                    ? state.map.zones.find((z) => z.id === guid)?.floorId
                    : undefined);

            if (itemFloor && itemFloor !== activeFloorId) continue;

            const bb = boundsOfGUID(state, guid);
            if (bb.width === 0 && bb.height === 0) continue;

            drawn.add(guid);

            this.g
                .rect(
                    bb.x - PADDING,
                    bb.y - PADDING,
                    bb.width + PADDING * 2,
                    bb.height + PADDING * 2,
                )
                .stroke({ width: LINE_WIDTH, color: ERROR_COLOR, alpha: ERROR_ALPHA });
        }
    }
}
