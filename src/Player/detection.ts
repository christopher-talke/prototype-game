import { environment } from '../Environment/environment';
import { getOtherPlayers, getPlayerElement, getPlayerInfo } from '../Globals/Players';
import { SETTINGS } from '../Globals/App';
import { isLineBlocked } from './Raycast/raycast';
import { debugLineOfSight, lineOfSight } from './lineOfSight';

// Max distance (squared) at which LOS is checked. Beyond this, player is always hidden.
const MAX_DETECT_DIST_SQ = 1800 * 1800;

export function detectOtherPlayers(targetPlayerId: number) {
    const playerInfo = getPlayerInfo(targetPlayerId);

    if (playerInfo) {
        const otherPlayers = getOtherPlayers(targetPlayerId);
        const px = playerInfo.current_position.x;
        const py = playerInfo.current_position.y;

        for (const targetPlayerInfo of otherPlayers) {
            const targetPlayerElement = getPlayerElement(targetPlayerInfo.id);
            if (!targetPlayerElement) continue;

            const dx = targetPlayerInfo.current_position.x - px;
            const dy = targetPlayerInfo.current_position.y - py;
            const distSq = dx * dx + dy * dy;

            const blocked = distSq > MAX_DETECT_DIST_SQ || isLineBlocked(
                px, py,
                targetPlayerInfo.current_position.x, 
                targetPlayerInfo.current_position.y, 
                environment.segments
            );

            if (SETTINGS.debug) {
                debugLineOfSight(blocked, targetPlayerInfo, playerInfo, targetPlayerElement);
            } else {
                lineOfSight(blocked, targetPlayerInfo, playerInfo, targetPlayerElement);
            }
        }
    }

    return;
}
