import './player.css'
import { ACTIVE_PLAYER, addPlayer, registerPlayerElement } from "../Globals/Players";
import { app } from '../main';
import { addPlayerInteractivity } from './interactivity';
export { SPEED, PLAYER_HIT_BOX, FOV } from '../constants';

export const HELD_DIRECTIONS = [] as string[]

export const directions: Record<string, string> = {
    up: 'up',
    down: 'down',
    left: 'left',
    right: 'right',
};

export const keys: Record<string, string | undefined> = {
    w: directions.up,
    W: directions.up,
    a: directions.left,
    A: directions.left,
    d: directions.right,
    D: directions.right,
    s: directions.down,
    S: directions.down,
};

export function createPlayer(playerInfo: player_info, controllable: boolean = false) {

    const newPlayerEntity = window.document.createElement('div');
    const newPlayerIdentifier = playerInfo.id;

    newPlayerEntity.id = `player-${newPlayerIdentifier}`;
    newPlayerEntity.classList.add(`player`);
    if (playerInfo.id === ACTIVE_PLAYER) {
        newPlayerEntity.classList.add(`visible`);
    }
    newPlayerEntity.classList.add(`team-${playerInfo.team}`);
    newPlayerEntity.setAttribute('data-player-team', `${playerInfo.team}`);
    newPlayerEntity.setAttribute('data-player-id', `${newPlayerIdentifier}`);
    newPlayerEntity.style.transform = `translate3d(${playerInfo.current_position.x}px, ${playerInfo.current_position.y}px, 0) rotate(${playerInfo.current_position.rotation}deg)`;

    app.appendChild(newPlayerEntity);
    addPlayer(playerInfo);
    registerPlayerElement(playerInfo.id, newPlayerEntity);

    const renderedPlayerElement = newPlayerEntity;

    if (controllable) {
        addPlayerInteractivity(renderedPlayerElement, newPlayerIdentifier);
    }

    return;
}
