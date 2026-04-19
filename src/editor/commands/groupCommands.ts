/**
 * Editor-only commands for the group abstraction.
 *
 * Unlike MapData mutations, group commands do NOT use SnapshotCommand; they
 * mutate `state.groups` directly in `do`/`undo`. They still flow through the
 * command stack so Ctrl+Z rolls them back. Structural commands trigger the
 * auto-save timer the same way as SnapshotCommand.
 *
 * Part of the editor layer.
 */

import type { EditorCommand, SerializedCommand } from './EditorCommand';
import type { EditorWorkingState } from '../state/EditorWorkingState';
import type { Group } from '../groups/Group';
import { nextDisplayName } from '../guid/displayNameCounter';
import { newGuid } from '../guid/idFactory';
import { MAX_GROUP_DEPTH } from '../groups/Group';
import { groupDepth, groupSubtreeDepth } from '../groups/groupQueries';

export const CREATE_GROUP_COMMAND_TYPE = 'group.create';
export const DISSOLVE_GROUP_COMMAND_TYPE = 'group.dissolve';
export const RENAME_GROUP_COMMAND_TYPE = 'group.rename';

interface CreateGroupPayload {
    group: Group;
    /** Parent group's memberIds array before the group existed. Null if parent is top-level (no parent group). */
    parentMembersBefore: string[] | null;
}

export class CreateGroupCommand implements EditorCommand {
    readonly description: string;
    readonly isStructural = true;

    constructor(
        private readonly group: Group,
        private readonly parentMembersBefore: string[] | null,
    ) {
        this.description = `Group ${group.memberIds.length} items as ${group.name}`;
    }

    do(state: EditorWorkingState): void {
        state.groups.set(this.group.id, { ...this.group, memberIds: [...this.group.memberIds] });

        if (this.group.parentGroupId) {
            const parent = state.groups.get(this.group.parentGroupId);
            if (parent) {
                const kept = parent.memberIds.filter((m) => !this.group.memberIds.includes(m));
                kept.push(this.group.id);
                parent.memberIds = kept;
            }
        }

        for (const m of this.group.memberIds) {
            if (state.groups.has(m) && m !== this.group.id) {
                state.groups.get(m)!.parentGroupId = this.group.id;
            }
        }
    }

    undo(state: EditorWorkingState): void {
        state.groups.delete(this.group.id);
        for (const m of this.group.memberIds) {
            if (state.groups.has(m)) {
                state.groups.get(m)!.parentGroupId = this.group.parentGroupId;
            }
        }
        if (this.group.parentGroupId && this.parentMembersBefore) {
            const parent = state.groups.get(this.group.parentGroupId);
            if (parent) parent.memberIds = [...this.parentMembersBefore];
        }
    }

    serialize(): SerializedCommand {
        const payload: CreateGroupPayload = {
            group: this.group,
            parentMembersBefore: this.parentMembersBefore,
        };
        return {
            type: CREATE_GROUP_COMMAND_TYPE,
            description: this.description,
            isStructural: this.isStructural,
            payload,
        };
    }
}

export function deserializeCreateGroupCommand(s: SerializedCommand): CreateGroupCommand {
    const payload = s.payload as CreateGroupPayload;
    return new CreateGroupCommand(payload.group, payload.parentMembersBefore);
}

interface DissolvePayload {
    group: Group;
    childReparentings: Array<{ groupId: string; newParent: string | null }>;
    parentInsertIndex: number;
}

export class DissolveGroupCommand implements EditorCommand {
    readonly description: string;
    readonly isStructural = true;

    constructor(
        private readonly group: Group,
        private readonly childReparentings: Array<{ groupId: string; newParent: string | null }>,
        private readonly parentInsertIndex: number,
    ) {
        this.description = `Dissolve ${group.name}`;
    }

    do(state: EditorWorkingState): void {
        const parent = this.group.parentGroupId
            ? state.groups.get(this.group.parentGroupId) ?? null
            : null;
        if (parent) {
            const idx = parent.memberIds.indexOf(this.group.id);
            if (idx >= 0) parent.memberIds.splice(idx, 1, ...this.group.memberIds);
        }
        for (const r of this.childReparentings) {
            const g = state.groups.get(r.groupId);
            if (g) g.parentGroupId = r.newParent;
        }
        state.groups.delete(this.group.id);
    }

    undo(state: EditorWorkingState): void {
        state.groups.set(this.group.id, {
            ...this.group,
            memberIds: [...this.group.memberIds],
        });
        for (const r of this.childReparentings) {
            const g = state.groups.get(r.groupId);
            if (g) g.parentGroupId = this.group.id;
        }
        const parent = this.group.parentGroupId
            ? state.groups.get(this.group.parentGroupId) ?? null
            : null;
        if (parent) {
            for (const memberId of this.group.memberIds) {
                const idx = parent.memberIds.indexOf(memberId);
                if (idx >= 0) parent.memberIds.splice(idx, 1);
            }
            parent.memberIds.splice(this.parentInsertIndex, 0, this.group.id);
        }
    }

    serialize(): SerializedCommand {
        const payload: DissolvePayload = {
            group: this.group,
            childReparentings: this.childReparentings,
            parentInsertIndex: this.parentInsertIndex,
        };
        return {
            type: DISSOLVE_GROUP_COMMAND_TYPE,
            description: this.description,
            isStructural: this.isStructural,
            payload,
        };
    }
}

export function deserializeDissolveGroupCommand(s: SerializedCommand): DissolveGroupCommand {
    const payload = s.payload as DissolvePayload;
    return new DissolveGroupCommand(payload.group, payload.childReparentings, payload.parentInsertIndex);
}

interface RenamePayload {
    groupId: string;
    previousName: string;
    nextName: string;
}

export class RenameGroupCommand implements EditorCommand {
    readonly description: string;
    readonly isStructural = false;

    constructor(
        private readonly groupId: string,
        private readonly previousName: string,
        private readonly nextName: string,
    ) {
        this.description = `Rename ${previousName} to ${nextName}`;
    }

    do(state: EditorWorkingState): void {
        const g = state.groups.get(this.groupId);
        if (g) g.name = this.nextName;
    }

    undo(state: EditorWorkingState): void {
        const g = state.groups.get(this.groupId);
        if (g) g.name = this.previousName;
    }

    serialize(): SerializedCommand {
        const payload: RenamePayload = {
            groupId: this.groupId,
            previousName: this.previousName,
            nextName: this.nextName,
        };
        return {
            type: RENAME_GROUP_COMMAND_TYPE,
            description: this.description,
            isStructural: this.isStructural,
            payload,
        };
    }
}

export function deserializeRenameGroupCommand(s: SerializedCommand): RenameGroupCommand {
    const payload = s.payload as RenamePayload;
    return new RenameGroupCommand(payload.groupId, payload.previousName, payload.nextName);
}

/**
 * Build a CreateGroupCommand from a selection. Returns null if:
 *  - fewer than 2 members,
 *  - members span multiple floors,
 *  - members have mismatched immediate parents (ambiguous nesting),
 *  - nesting would exceed MAX_GROUP_DEPTH.
 * Accepts item GUIDs and/or existing group ids as members.
 */
export function buildCreateGroupCommand(
    state: EditorWorkingState,
    memberIds: readonly string[],
): CreateGroupCommand | null {
    if (memberIds.length < 2) return null;

    let floorId: string | null = null;
    for (const id of memberIds) {
        const f = floorOf(state, id);
        if (!f) return null;
        if (floorId === null) floorId = f;
        else if (floorId !== f) return null;
    }
    if (!floorId) return null;

    const sharedParent = commonImmediateParent(state, memberIds);
    if (sharedParent === undefined) return null;

    const newDepth = sharedParent ? groupDepth(state, sharedParent) + 1 : 1;
    let subtree = 1;
    for (const m of memberIds) {
        if (state.groups.has(m)) {
            const d = 1 + groupSubtreeDepth(state, m);
            if (d > subtree) subtree = d;
        }
    }
    if (newDepth + subtree - 1 > MAX_GROUP_DEPTH) return null;

    const name = nextDisplayName(state.counters, 'group');
    const id = newGuid();

    const parentMembersBefore = sharedParent
        ? [...(state.groups.get(sharedParent)?.memberIds ?? [])]
        : null;

    const group: Group = {
        id,
        name,
        floorId,
        memberIds: [...memberIds],
        parentGroupId: sharedParent,
    };
    return new CreateGroupCommand(group, parentMembersBefore);
}

/** Build a DissolveGroupCommand. Returns null if `groupId` does not exist. */
export function buildDissolveGroupCommand(
    state: EditorWorkingState,
    groupId: string,
): DissolveGroupCommand | null {
    const g = state.groups.get(groupId);
    if (!g) return null;

    const snapshot: Group = { ...g, memberIds: [...g.memberIds] };
    const childReparentings: Array<{ groupId: string; newParent: string | null }> = [];
    for (const m of g.memberIds) {
        if (state.groups.has(m)) {
            childReparentings.push({ groupId: m, newParent: g.parentGroupId });
        }
    }
    let parentInsertIndex = -1;
    if (g.parentGroupId) {
        const parent = state.groups.get(g.parentGroupId);
        if (parent) parentInsertIndex = parent.memberIds.indexOf(groupId);
    }
    return new DissolveGroupCommand(snapshot, childReparentings, parentInsertIndex);
}

/** Build a RenameGroupCommand. Returns null if unchanged or unknown. */
export function buildRenameGroupCommand(
    state: EditorWorkingState,
    groupId: string,
    newName: string,
): RenameGroupCommand | null {
    const g = state.groups.get(groupId);
    if (!g) return null;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === g.name) return null;
    return new RenameGroupCommand(groupId, g.name, trimmed);
}

function floorOf(state: EditorWorkingState, id: string): string | null {
    if (state.groups.has(id)) return state.groups.get(id)!.floorId;
    const ref = state.byGUID.get(id);
    if (!ref) return null;
    if (ref.floorId) return ref.floorId;
    return null;
}

function currentParentOf(state: EditorWorkingState, id: string): string | null {
    if (state.groups.has(id)) return state.groups.get(id)!.parentGroupId;
    for (const g of state.groups.values()) {
        if (g.memberIds.includes(id)) return g.id;
    }
    return null;
}

/**
 * Return the common immediate parent group id of `memberIds`, or null if all
 * are top-level, or `undefined` if they disagree.
 */
function commonImmediateParent(
    state: EditorWorkingState,
    memberIds: readonly string[],
): string | null | undefined {
    let parent: string | null | undefined;
    for (const m of memberIds) {
        const p = currentParentOf(state, m);
        if (parent === undefined) parent = p;
        else if (parent !== p) return undefined;
    }
    return parent;
}
