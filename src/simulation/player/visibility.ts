import { getAngle } from '@utils/getAngle';
import { FOV, ROTATION_OFFSET } from '../../constants';
import { ACTIVE_PLAYER } from './playerRegistry';
import { normalizeAngle } from '@utils/normalizeAngle';

const wasVisible = new Map<string, boolean>();

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

export function lineOfSight(blocked: boolean, targetPlayerInfo: player_info, sourcePlayerInfo: player_info): LOSResult {
    const canSee = !blocked && isFacingTarget(sourcePlayerInfo, targetPlayerInfo);
    const key = `${sourcePlayerInfo.id}-${targetPlayerInfo.id}`;
    const prevVisible = wasVisible.get(key) ?? false;
    const stateChanged = canSee !== prevVisible || !wasVisible.has(key);
    const sameTeam = sourcePlayerInfo.team === targetPlayerInfo.team;
    const isLocalView = sourcePlayerInfo.id === ACTIVE_PLAYER;

    wasVisible.set(key, canSee);

    return { canSee, stateChanged, sameTeam, isLocalView, prevVisible };
}
