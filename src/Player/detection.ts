import { environment } from '../Environment/environment';
import { getOtherPlayers, getPlayerElement, getPlayerInfo } from '../Globals/Players';
import { SETTINGS } from '../main';
import { isLineBlocked } from './Raycast/raycast';
import { debugLineOfSight, lineOfSight } from './lineOfSight';

export function detectOtherPlayers(targetPlayerId: number) {
    const playerInfo = getPlayerInfo(targetPlayerId);

    if (playerInfo) {
        const otherPlayers = getOtherPlayers(targetPlayerId);

        for (const targetPlayerInfo of otherPlayers) {
            const targetPlayerElement = getPlayerElement(targetPlayerInfo.id);
            if (!targetPlayerElement) continue;

            const blocked = isLineBlocked(playerInfo.current_position.x, playerInfo.current_position.y, targetPlayerInfo.current_position.x, targetPlayerInfo.current_position.y, environment.segments);

            if (SETTINGS.debug) {
                debugLineOfSight(blocked, targetPlayerInfo, playerInfo, targetPlayerElement);
            } else {
                lineOfSight(blocked, targetPlayerInfo, playerInfo, targetPlayerElement);
            }
        }
    }

    return;
}
