import { getAdapter } from '@net/activeAdapter';
import { ACTIVE_PLAYER } from '@simulation/player/playerRegistry';

let isFiring = false;

export function getIsFiring(): boolean {
    return isFiring;
}

export function getActiveWeapon(playerInfo: player_info): PlayerWeapon | undefined {
    return playerInfo.weapons.find((w) => w.active);
}

const UI_SELECTORS = '#settings-menu, #hud-buymenu, #main-menu, #hud-pause, #hud-match-end';

export function initShooting() {
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            if ((e.target as HTMLElement).closest(UI_SELECTORS)) return;
            e.preventDefault();
            isFiring = true;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isFiring = false;
            const playerId = ACTIVE_PLAYER;
            if (playerId != null) {
                getAdapter().sendInput({ type: 'STOP_FIRE', playerId, timestamp: performance.now() });
            }
        }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());
}
