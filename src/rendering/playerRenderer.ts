import '@rendering/css/player.css';
import { app, SETTINGS } from '../app';
import { HALF_HIT_BOX } from '../constants';
import { ACTIVE_PLAYER, addPlayer } from '@simulation/player/playerRegistry';
import { registerPlayerElement, registerHealthBarElement, getHealthBarElement, registerNametagElement } from '@rendering/playerElements';
import { cssTransform } from '@rendering/cssTransform';
import { createPixiPlayer } from '@rendering/pixi/pixiPlayerRenderer';

// Cached child references to avoid querySelector per updateHealthBar call
const healthBarChildren = new Map<number, { bar: HTMLElement; armor: HTMLElement }>();

export function createPlayer(playerInfo: player_info, controllable: boolean = false, localTeam?: number) {
    if (SETTINGS.renderer === 'pixi') {
        createPixiPlayer(playerInfo, controllable, localTeam);
        return null;
    }

    if (app === undefined) return null;

    const newPlayerEntity = window.document.createElement('div');
    const newPlayerIdentifier = playerInfo.id;

    newPlayerEntity.id = `player-${newPlayerIdentifier}`;
    newPlayerEntity.classList.add(`player`);
    if (playerInfo.id === ACTIVE_PLAYER) {
        newPlayerEntity.classList.add(`visible`);
    }
    newPlayerEntity.setAttribute('data-team', `${playerInfo.team}`);
    newPlayerEntity.setAttribute('data-player-id', `${newPlayerIdentifier}`);
    newPlayerEntity.style.transform = cssTransform(playerInfo.current_position.x, playerInfo.current_position.y, playerInfo.current_position.rotation);

    app.appendChild(newPlayerEntity);
    addPlayer(playerInfo);
    registerPlayerElement(playerInfo.id, newPlayerEntity);

    if (!controllable) {
        const wrap = document.createElement('div');
        wrap.classList.add('player-health-wrap');

        const bar = document.createElement('div');
        bar.classList.add('player-health-bar');

        const armor = document.createElement('div');
        armor.classList.add('player-armor-bar');

        wrap.appendChild(armor);
        wrap.appendChild(bar);
        app.appendChild(wrap);

        positionHealthBar(wrap, playerInfo);
        registerHealthBarElement(playerInfo.id, wrap);
        healthBarChildren.set(playerInfo.id, { bar, armor });

        const sameTeam = localTeam != null && localTeam === playerInfo.team;
        if (sameTeam) {
            const nameTag = document.createElement('div');
            nameTag.classList.add('player-nametag');
            nameTag.textContent = playerInfo.name;
            app.appendChild(nameTag);
            positionNametag(nameTag, playerInfo);
            registerNametagElement(playerInfo.id, nameTag);
        }
    }

    return newPlayerEntity;
}

export function positionHealthBar(wrap: HTMLElement, playerInfo: player_info) {
    const x = playerInfo.current_position.x + HALF_HIT_BOX;
    const y = playerInfo.current_position.y;
    wrap.style.transform = cssTransform(x, y);
}

export function positionNametag(el: HTMLElement, playerInfo: player_info) {
    const x = playerInfo.current_position.x + HALF_HIT_BOX;
    const y = playerInfo.current_position.y - 36;
    el.style.transform = cssTransform(x, y);
}

export function updateHealthBar(playerInfo: player_info) {
    const wrap = getHealthBarElement(playerInfo.id);
    if (!wrap) return;

    const cached = healthBarChildren.get(playerInfo.id);
    if (cached) {
        cached.bar.style.width = `${Math.max(0, playerInfo.health)}%`;
        cached.armor.style.width = `${Math.max(0, playerInfo.armour)}%`;
    }

    positionHealthBar(wrap, playerInfo);
}
