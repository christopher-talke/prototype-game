import { environment } from '@simulation/environment/environment';
import { iterOtherPlayers, getPlayerInfo } from '@simulation/player/playerRegistry';
import { isLineBlocked } from './raycast';
import { lineOfSight, type LOSResult } from '@simulation/player/visibility';

const MAX_DETECT_DIST_SQ = 1800 * 1800;

/**
 * A single visibility entry produced by `detectOtherPlayers`.
 *
 * Layer: simulation - detection sub-domain.
 * Consumed by: game loop (FOW filtering, event dispatch) and the server-side
 * authoritative simulation.
 */
export type DetectionEntry = {
    targetId: number;
    targetPlayer: player_info;
    sourcePlayer: player_info;
    blocked: boolean;
    result: LOSResult;
};

const _entries: DetectionEntry[] = [];
const _result = { entries: _entries as readonly DetectionEntry[], count: 0 };

/**
 * Runs a visibility check from `sourcePlayerId` against every other live player.
 *
 * Uses a pre-allocated entry pool to avoid per-frame heap allocations. The
 * returned object is reused on every call - callers must consume it before the
 * next invocation.
 *
 * @param sourcePlayerId - Registry id of the observing player.
 * @returns Reused result object with a readonly entry slice and a live `count`.
 *          Returns count=0 when the source player does not exist.
 */
export function detectOtherPlayers(sourcePlayerId: number): { entries: readonly DetectionEntry[]; count: number } {
    const sourcePlayer = getPlayerInfo(sourcePlayerId);
    if (!sourcePlayer) { _result.count = 0; return _result; }

    const px = sourcePlayer.current_position.x;
    const py = sourcePlayer.current_position.y;

    let count = 0;
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

        const los = lineOfSight(blocked, targetPlayer, sourcePlayer);
        if (count < _entries.length) {
            const e = _entries[count];
            e.targetId = targetPlayer.id;
            e.targetPlayer = targetPlayer;
            e.sourcePlayer = sourcePlayer;
            e.blocked = blocked;
            e.result.canSee = los.canSee;
            e.result.stateChanged = los.stateChanged;
            e.result.sameTeam = los.sameTeam;
            e.result.isLocalView = los.isLocalView;
            e.result.prevVisible = los.prevVisible;
        }

        else {
            _entries.push({
                targetId: targetPlayer.id, targetPlayer, sourcePlayer, blocked,
                result: { canSee: los.canSee, stateChanged: los.stateChanged, sameTeam: los.sameTeam, isLocalView: los.isLocalView, prevVisible: los.prevVisible },
            });
        }

        count++;
    }

    _result.count = count;
    return _result;
}
