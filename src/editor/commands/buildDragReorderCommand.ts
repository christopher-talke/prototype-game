/**
 * Route drag-drop intents from the unified tree to the right underlying
 * command (backing-array reorder, memberIds move, or both as a composite).
 *
 * The drag UI calls this with just two GUIDs and a position; routing logic
 * lives here so the UI stays dumb.
 *
 * Part of the editor layer.
 */

import type { EditorCommand } from './EditorCommand';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { parentOf } from '../groups/groupQueries';
import { buildReorderItemCommand, type ReorderPosition } from './reorderItemCommand';
import { buildMoveMemberCommand } from './moveMemberCommand';
import { CompositeCommand } from './compositeCommand';

/**
 * Build a command for dropping `movingId` relative to `targetId`. Both ids are
 * item GUIDs or nested group ids. Returns null when the drop cannot be
 * resolved to a legal mutation.
 */
export function buildDragReorderCommand(
    state: EditorWorkingState,
    movingId: string,
    targetId: string,
    position: ReorderPosition,
): EditorCommand | null {
    if (movingId === targetId) return null;

    const sourceParent = parentOf(state, movingId);
    const targetParent = parentOf(state, targetId);

    if (sourceParent === null && targetParent === null) {
        return buildReorderItemCommand(state, movingId, targetId, position);
    }

    if (sourceParent && targetParent === sourceParent) {
        return buildMoveMemberCommand(state, movingId, {
            kind: 'group',
            groupId: sourceParent,
            anchorMemberId: targetId,
            position,
        });
    }

    if (sourceParent === null && targetParent) {
        return buildMoveMemberCommand(state, movingId, {
            kind: 'group',
            groupId: targetParent,
            anchorMemberId: targetId,
            position,
        });
    }

    if (sourceParent && targetParent === null) {
        const pullOut = buildMoveMemberCommand(state, movingId, { kind: 'root' });
        if (!pullOut) return null;
        const reorder = buildReorderItemCommand(state, movingId, targetId, position);
        if (!reorder) return pullOut;
        return new CompositeCommand([pullOut, reorder], 'Move item to root');
    }

    if (sourceParent && targetParent && sourceParent !== targetParent) {
        return buildMoveMemberCommand(state, movingId, {
            kind: 'group',
            groupId: targetParent,
            anchorMemberId: targetId,
            position,
        });
    }

    return null;
}
