import { environment } from '@simulation/environment/environment';
import { iterOtherPlayers, getPlayerInfo } from '@simulation/player/playerRegistry';
import { isLineBlocked } from './raycast';
import { lineOfSight, type LOSResult } from '@simulation/player/visibility';

const MAX_DETECT_DIST_SQ = 1800 * 1800;

export type DetectionEntry = {
    targetId: number;
    targetPlayer: player_info;
    sourcePlayer: player_info;
    blocked: boolean;
    result: LOSResult;
};

export function detectOtherPlayers(sourcePlayerId: number): DetectionEntry[] {
    const sourcePlayer = getPlayerInfo(sourcePlayerId);
    if (!sourcePlayer) return [];

    const px = sourcePlayer.current_position.x;
    const py = sourcePlayer.current_position.y;
    const entries: DetectionEntry[] = [];

    for (const targetPlayer of iterOtherPlayers(sourcePlayerId)) {
        const dx = targetPlayer.current_position.x - px;
        const dy = targetPlayer.current_position.y - py;
        const distSq = dx * dx + dy * dy;

        const blocked = distSq > MAX_DETECT_DIST_SQ || isLineBlocked(
            px, py,
            targetPlayer.current_position.x,
            targetPlayer.current_position.y,
            environment.segments,
        );

        const result = lineOfSight(blocked, targetPlayer, sourcePlayer);
        entries.push({ targetId: targetPlayer.id, targetPlayer, sourcePlayer, blocked, result });
    }

    return entries;
}
