/**
 * Line-of-sight (LOS) visibility checks between players.
 * Determines whether a source player can see a target based on FOV angle and ray blocking.
 * Tracks visibility state changes for the rendering layer's reveal/hide transitions.
 *
 * Simulation layer - does not depend on rendering, net, or orchestration.
 */

import { getAngle } from '@utils/getAngle';
import { FOV, ROTATION_OFFSET } from '../../constants';
import { ACTIVE_PLAYER } from './playerRegistry';
import { normalizeAngle } from '@utils/normalizeAngle';

const wasVisible = new Map<number, boolean>();

/**
 * Checks whether the source player's FOV cone includes the target player's position.
 * @param sourcePlayerInfo - The player doing the looking.
 * @param targetPlayerInfo - The player being looked at.
 * @returns True if the target is within the source's field of view.
 */
export function isFacingTarget(sourcePlayerInfo: player_info, targetPlayerInfo: player_info): boolean {
    const angleToTarget = getAngle(sourcePlayerInfo.current_position.x, sourcePlayerInfo.current_position.y, targetPlayerInfo.current_position.x, targetPlayerInfo.current_position.y);
    const facingAngle = sourcePlayerInfo.current_position.rotation - ROTATION_OFFSET;
    const diff = normalizeAngle(angleToTarget - facingAngle);
    return diff > -FOV && diff < FOV;
}

/**
 * Result of a line-of-sight check between two players.
 * Consumed by the detection system and rendering layer for visibility transitions.
 */
export type LOSResult = {
    canSee: boolean;
    stateChanged: boolean;
    sameTeam: boolean;
    isLocalView: boolean;
    prevVisible: boolean;
};

/** Pre-allocated LOS result object reused each call to avoid per-frame allocations. */
const _losResult: LOSResult = { canSee: false, stateChanged: false, sameTeam: false, isLocalView: false, prevVisible: false };

/**
 * Computes line-of-sight from source to target, combining ray-blocking with FOV checks.
 * Tracks per-pair visibility history to detect state transitions (appear/disappear).
 * Uses a numeric map key (sourceId*10000+targetId) to avoid string allocation.
 *
 * WARNING: Returns a shared mutable object - callers must copy fields if needed across calls.
 *
 * @param blocked - Whether the ray between the two players is blocked by walls/smoke.
 * @param targetPlayerInfo - The player being observed.
 * @param sourcePlayerInfo - The player doing the observing.
 * @returns Shared LOSResult with visibility state and transition info.
 */
export function lineOfSight(blocked: boolean, targetPlayerInfo: player_info, sourcePlayerInfo: player_info): LOSResult {
    const canSee = !blocked && isFacingTarget(sourcePlayerInfo, targetPlayerInfo);
    const key = sourcePlayerInfo.id * 10000 + targetPlayerInfo.id;
    const prevVisible = wasVisible.get(key) ?? false;

    _losResult.canSee = canSee;
    _losResult.stateChanged = canSee !== prevVisible || !wasVisible.has(key);
    _losResult.sameTeam = sourcePlayerInfo.team === targetPlayerInfo.team;
    _losResult.isLocalView = sourcePlayerInfo.id === ACTIVE_PLAYER;
    _losResult.prevVisible = prevVisible;

    wasVisible.set(key, canSee);

    return _losResult;
}
