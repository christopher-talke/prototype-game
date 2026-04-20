/**
 * Editor-only command: move an item GUID or nested group id within or between
 * groups. Mutates `state.groups` directly, matching the pattern used by
 * `groupCommands.ts` (CreateGroupCommand etc.).
 *
 * Targets:
 *  - `{ kind: 'group', groupId, anchorMemberId, position }`
 *     Insert the moving node before/after `anchorMemberId` inside `groupId`.
 *  - `{ kind: 'group-end', groupId }`
 *     Append the moving node to the end of `groupId`. Used for drops onto an
 *     empty group or the group's trailing drop zone.
 *  - `{ kind: 'root' }`
 *     Remove the moving node from its current parent group. Item GUIDs keep
 *     their position in the backing MapData array; nested groups become
 *     top-level.
 *
 * Part of the editor layer.
 */

import type { EditorCommand, SerializedCommand } from './EditorCommand';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import { parentOf, wouldCreateCycle } from '../groups/groupQueries';
import type { ReorderPosition } from './mapMutators';

export const MOVE_MEMBER_COMMAND_TYPE = 'group.moveMember';

export type MoveMemberTarget =
    | { kind: 'group'; groupId: string; anchorMemberId: string; position: ReorderPosition }
    | { kind: 'group-end'; groupId: string }
    | { kind: 'root' };

interface MoveMemberPayload {
    movingId: string;
    movingWasGroup: boolean;
    sourceParentId: string | null;
    sourceMemberIdsBefore: string[] | null;
    sourceMemberIdsAfter: string[] | null;
    targetParentId: string | null;
    targetMemberIdsBefore: string[] | null;
    targetMemberIdsAfter: string[] | null;
}

export class MoveMemberCommand implements EditorCommand {
    readonly description: string;
    readonly isStructural = false;

    constructor(private readonly payload: MoveMemberPayload) {
        this.description = 'Move item';
    }

    do(state: EditorWorkingState): void {
        apply(state, this.payload, 'after');
    }

    undo(state: EditorWorkingState): void {
        apply(state, this.payload, 'before');
    }

    serialize(): SerializedCommand {
        return {
            type: MOVE_MEMBER_COMMAND_TYPE,
            description: this.description,
            isStructural: this.isStructural,
            payload: this.payload,
        };
    }
}

export function deserializeMoveMemberCommand(s: SerializedCommand): MoveMemberCommand {
    return new MoveMemberCommand(s.payload as MoveMemberPayload);
}

function apply(state: EditorWorkingState, p: MoveMemberPayload, phase: 'before' | 'after'): void {
    if (p.sourceParentId) {
        const src = state.groups.get(p.sourceParentId);
        if (src) {
            const next = phase === 'after' ? p.sourceMemberIdsAfter : p.sourceMemberIdsBefore;
            if (next) src.memberIds = [...next];
        }
    }
    if (p.targetParentId && p.targetParentId !== p.sourceParentId) {
        const tgt = state.groups.get(p.targetParentId);
        if (tgt) {
            const next = phase === 'after' ? p.targetMemberIdsAfter : p.targetMemberIdsBefore;
            if (next) tgt.memberIds = [...next];
        }
    }
    if (p.movingWasGroup) {
        const g = state.groups.get(p.movingId);
        if (g) {
            g.parentGroupId = phase === 'after' ? p.targetParentId : p.sourceParentId;
        }
    }
}

/**
 * Build a move command. Returns null when:
 *  - the moving id is unknown,
 *  - the move is a no-op (same parent + same anchor position),
 *  - moving a group into a descendant would cycle or exceed MAX_GROUP_DEPTH,
 *  - the moving node and target group would span different floors.
 */
export function buildMoveMemberCommand(
    state: EditorWorkingState,
    movingId: string,
    target: MoveMemberTarget,
): MoveMemberCommand | null {
    const movingIsGroup = state.groups.has(movingId);
    const movingItem = state.byGUID.get(movingId);
    if (!movingIsGroup && !movingItem) return null;

    const sourceParentId = parentOf(state, movingId);
    const sourceFloor = movingIsGroup
        ? state.groups.get(movingId)!.floorId
        : movingItem?.floorId ?? null;

    let targetGroupId: string | null;
    let targetInsertIdx: number;
    if (target.kind === 'root') {
        if (!sourceParentId) return null;
        targetGroupId = null;
        targetInsertIdx = -1;
    } else if (target.kind === 'group-end') {
        const g = state.groups.get(target.groupId);
        if (!g) return null;
        targetGroupId = g.id;
        targetInsertIdx = g.memberIds.length;
    } else {
        const g = state.groups.get(target.groupId);
        if (!g) return null;
        const anchorIdx = g.memberIds.indexOf(target.anchorMemberId);
        if (anchorIdx < 0) return null;
        targetGroupId = g.id;
        targetInsertIdx = target.position === 'after' ? anchorIdx + 1 : anchorIdx;
    }

    if (targetGroupId) {
        const targetGroup = state.groups.get(targetGroupId)!;
        if (sourceFloor && targetGroup.floorId !== sourceFloor) return null;
    }

    if (movingIsGroup && targetGroupId) {
        if (wouldCreateCycle(state, movingId, targetGroupId)) return null;
    }

    const sourceBefore = sourceParentId
        ? [...(state.groups.get(sourceParentId)?.memberIds ?? [])]
        : null;
    const targetBefore = targetGroupId
        ? targetGroupId === sourceParentId
            ? sourceBefore
            : [...(state.groups.get(targetGroupId)?.memberIds ?? [])]
        : null;

    let sourceAfter: string[] | null = null;
    let targetAfter: string[] | null = null;
    if (sourceParentId && targetGroupId === sourceParentId && sourceBefore) {
        const fromIdx = sourceBefore.indexOf(movingId);
        if (fromIdx < 0) return null;
        const working = [...sourceBefore];
        working.splice(fromIdx, 1);
        let insertIdx = targetInsertIdx;
        if (fromIdx < targetInsertIdx) insertIdx -= 1;
        working.splice(insertIdx, 0, movingId);
        let samePosition = true;
        for (let i = 0; i < working.length; i++) {
            if (working[i] !== sourceBefore[i]) {
                samePosition = false;
                break;
            }
        }
        if (samePosition) return null;
        sourceAfter = working;
        targetAfter = working;
    } else {
        if (sourceParentId && sourceBefore) {
            const idx = sourceBefore.indexOf(movingId);
            if (idx < 0) return null;
            sourceAfter = [...sourceBefore];
            sourceAfter.splice(idx, 1);
        }
        if (targetGroupId && targetBefore) {
            targetAfter = [...targetBefore];
            targetAfter.splice(targetInsertIdx, 0, movingId);
        }
        if (!sourceParentId && !targetGroupId) return null;
    }

    return new MoveMemberCommand({
        movingId,
        movingWasGroup: movingIsGroup,
        sourceParentId,
        sourceMemberIdsBefore: sourceBefore ? [...sourceBefore] : null,
        sourceMemberIdsAfter: sourceAfter,
        targetParentId: targetGroupId,
        targetMemberIdsBefore: targetBefore ? [...targetBefore] : null,
        targetMemberIdsAfter: targetAfter,
    });
}
