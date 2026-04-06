import { ACTIVE_PLAYER, getPlayerInfo } from '../Globals/Players';
import { app } from '../main';
import { getRandomNumber } from '../Utilities/getRandomNumber';

export function createDebug() {
    if (ACTIVE_PLAYER) {
        const currentPlayer = getPlayerInfo(ACTIVE_PLAYER);
        if (currentPlayer === undefined) return;

        const newDebugEntity = window.document.createElement('div');
        const newDebugIdentifier = getRandomNumber(1000, 9999);

        // Set an ID for the new Debug on their element.
        // Set the team for the new Debug.
        newDebugEntity.id = `debug-${newDebugIdentifier}`;
        newDebugEntity.classList.add(`debug`);
        newDebugEntity.setAttribute('data-Debug-id', `${newDebugIdentifier}`);
        newDebugEntity.style.transform = `translate3d(${currentPlayer.current_position.x}px, ${currentPlayer.current_position.y}px, 0) rotate(0deg)`;

        // Write Debug to screen
        app.appendChild(newDebugEntity);

        // Camera & Current Position Loop
        // let renderedDebugElement = document.getElementById(newDebugEntity.id) as HTMLElement;
    }

    return;
}
