import { getAngle } from '@utils/getAngle';
import { FOV, ROTATION_OFFSET } from '../../constants';
import { ACTIVE_PLAYER } from './playerRegistry';
import { normalizeAngle } from '@utils/normalizeAngle';

const wasVisible = new Map<number, boolean>();

export function isFacingTarget(sourcePlayerInfo: player_info, targetPlayerInfo: player_info): boolean {
    const angleToTarget = getAngle(sourcePlayerInfo.current_position.x, sourcePlayerInfo.current_position.y, targetPlayerInfo.current_position.x, targetPlayerInfo.current_position.y);
    const facingAngle = sourcePlayerInfo.current_position.rotation - ROTATION_OFFSET;
    const diff = normalizeAngle(angleToTarget - facingAngle);
    return diff > -FOV && diff < FOV;
}

export type LOSResult = {
    canSee: boolean;
    stateChanged: boolean;
    sameTeam: boolean;
    isLocalView: boolean;
    prevVisible: boolean;
};

const _losResult: LOSResult = { canSee: false, stateChanged: false, sameTeam: false, isLocalView: false, prevVisible: false };

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
