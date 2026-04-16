/**
 * Input controller - binds keyboard, mouse, and wheel events to game actions.
 *
 * Orchestration layer - translates raw browser input events into adapter
 * inputs (MOVE, FIRE, ROTATE, RELOAD, SWITCH_WEAPON, THROW_GRENADE, etc.)
 * and manages firing state, grenade selection/charging, and menu toggling.
 */

import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { getAngle } from '@utils/getAngle';
import { HELD_DIRECTIONS, directions } from '@simulation/player/playerData';
export { getMovementInput } from './movementInput';
import { toggleSettings, isSettingsOpen, closeSettings } from '@ui/settings/settings';
import { getActionForKey } from '@ui/settings/keybinds';
import { getAdapter } from '@net/activeAdapter';
import { toggleBuyMenu, isBuyMenuOpen, closeBuyMenu, updateCrosshairPosition, showLeaderboard, hideLeaderboard, isPauseOpen, openPause, closePause } from '@rendering/dom/hud';
import { isPlayerDead } from '@simulation/combat/damage';
import { setMouseWorldPosition, getMouseWorldPosition } from '@utils/mouseWorldPosition';
import { getConfig } from '@config/activeConfig';
import { screenToWorld } from '@rendering/coordConvert';
import { setZoomHold } from '@rendering/canvas/camera';

let isFiring = false;

/** Whether the primary fire button is currently held down. */
export function getIsFiring(): boolean {
    return isFiring;
}

const UI_SELECTORS = '#settings-menu, #hud-buymenu, #main-menu, #lobby-screen, #hud-pause, #hud-match-end, #lighting-debug-panel';

/**
 * Registers mousedown/mouseup listeners that track the firing state and
 * send STOP_FIRE when the button is released. Also suppresses the
 * context menu on right-click.
 */
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

    window.addEventListener('contextmenu', (e) => e.preventDefault());
}

const GRENADE_ORDER: GrenadeType[] = ['FRAG', 'FLASH', 'SMOKE', 'C4'];
let selectedGrenadeIndex = 0;
let grenadeChargeStart = 0;
let grenadeCharging = false;

/** Returns the grenade type currently selected by the player. */
export function getSelectedGrenadeType(): GrenadeType {
    return GRENADE_ORDER[selectedGrenadeIndex];
}

/**
 * Cycles the grenade selection forward or backward, skipping types the
 * player does not have in inventory. Wraps around the ordered list.
 * @param delta - Direction to cycle: +1 forward, -1 backward.
 */
function cycleGrenade(delta: number) {
    const player = getActivePlayerInfo();
    if (!player) return;

    for (let i = 0; i < GRENADE_ORDER.length; i++) {
        // Cycle through grenade types in the order of GRENADE_ORDER, starting from the current selection, and find the next one that the player has.
        // Grenades that the player doesn't have are skipped. If the player has no grenades, this does nothing.
        const next = (((selectedGrenadeIndex + delta * (i + 1)) % GRENADE_ORDER.length) + GRENADE_ORDER.length) % GRENADE_ORDER.length;
        if (player.grenades[GRENADE_ORDER[next]] > 0) {
            selectedGrenadeIndex = next;
            return;
        }
    }

    // Default to index 0 if no grenades found, which will show the "no grenades" indicator in the UI.
    selectedGrenadeIndex = 0;
}

/**
 * Returns the current grenade charge as a 0-1 fraction based on how long
 * the grenade key has been held relative to the configured charge time.
 */
export function getGrenadeChargePercent(): number {
    if (!grenadeCharging) return 0;
    return Math.min(1, (performance.now() - grenadeChargeStart) / getConfig().grenades.chargeTime);
}

/**
 * Returns the player_info for the locally controlled player, or null if
 * no active player is set.
 */
function getActivePlayerInfo(): player_info | null {
    if (ACTIVE_PLAYER == null) return null;
    return (getPlayerInfo(ACTIVE_PLAYER) as player_info) ?? null;
}

/** Whether any game menu (settings, buy menu, or pause) is currently open. */
export function isMenuOpen(): boolean {
    return isSettingsOpen() || isBuyMenuOpen() || isPauseOpen();
}

/**
 * Registers all keyboard, mouse-move, and wheel event listeners for
 * gameplay input. Handles movement key tracking, weapon switching, reload,
 * grenade charging/throwing, mouse rotation, and menu shortcuts.
 *
 * Should be called once during game initialization.
 */
export function initInputController() {
    window.addEventListener('keydown', (e) => {
        if (isSettingsOpen() && e.key !== 'Escape') return;

        if (e.key === 'Escape') {
            if (isSettingsOpen()) { closeSettings(); return; }
            if (isBuyMenuOpen()) { closeBuyMenu(); return; }
            if (isPauseOpen()) { closePause(); return; }
            openPause();
            return;
        }

        const action = getActionForKey(e.key);
        const menuOpen = isMenuOpen();
        const activePlayer = getActivePlayerInfo();

        if (action === 'settings') toggleSettings();
        if (activePlayer && action === 'buyMenu') toggleBuyMenu(activePlayer);

        if (menuOpen) return;

        if (e.key === 'z' || e.key === 'Z') setZoomHold(true);

        if (action === 'moveUp' && HELD_DIRECTIONS.indexOf(directions.up) === -1) HELD_DIRECTIONS.unshift(directions.up);
        if (action === 'moveDown' && HELD_DIRECTIONS.indexOf(directions.down) === -1) HELD_DIRECTIONS.unshift(directions.down);
        if (action === 'moveLeft' && HELD_DIRECTIONS.indexOf(directions.left) === -1) HELD_DIRECTIONS.unshift(directions.left);
        if (action === 'moveRight' && HELD_DIRECTIONS.indexOf(directions.right) === -1) HELD_DIRECTIONS.unshift(directions.right);

        if (activePlayer && action === 'reload') getAdapter().sendInput({ type: 'RELOAD', playerId: activePlayer.id });
        if (activePlayer && action === 'weapon1') getAdapter().sendInput({ type: 'SWITCH_WEAPON', playerId: activePlayer.id, slotIndex: 0 });
        if (activePlayer && action === 'weapon2') getAdapter().sendInput({ type: 'SWITCH_WEAPON', playerId: activePlayer.id, slotIndex: 1 });
        if (activePlayer && action === 'weapon3') getAdapter().sendInput({ type: 'SWITCH_WEAPON', playerId: activePlayer.id, slotIndex: 2 });

        if (action === 'leaderboard') {
            e.preventDefault();
            showLeaderboard();
        }

        if (activePlayer && action === 'grenade' && !isPlayerDead(activePlayer) && !grenadeCharging) {
            const type = getSelectedGrenadeType();

            // C4 is placed (inventory empty) - detonate and cycle away
            if (type === 'C4' && activePlayer.grenades[type] === 0) {
                getAdapter().sendInput({ type: 'DETONATE_C4', playerId: activePlayer.id });
                cycleGrenade(1);
            }

            if (activePlayer.grenades[type] > 0) {
                grenadeCharging = true;
                grenadeChargeStart = performance.now();
            }
        }
    });

    window.addEventListener('mousemove', (e) => {
        updateCrosshairPosition(e.clientX, e.clientY);
        const activePlayer = getActivePlayerInfo();
        if (activePlayer) {
            const mouseWorld = screenToWorld(e.clientX, e.clientY);
            setMouseWorldPosition(mouseWorld.x, mouseWorld.y);

            const centerX = activePlayer.current_position.x + HALF_HIT_BOX;
            const centerY = activePlayer.current_position.y + HALF_HIT_BOX;

            const newRotation = getAngle(centerX, centerY, mouseWorld.x, mouseWorld.y) + ROTATION_OFFSET;

            // Client-side prediction: set rotation immediately for zero-latency mouse feedback
            activePlayer.current_position.rotation = newRotation;
            getAdapter().sendInput({ type: 'ROTATE', playerId: activePlayer.id, rotation: newRotation });
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'z' || e.key === 'Z') setZoomHold(false);

        const action = getActionForKey(e.key);

        if (action === 'moveUp') { const i = HELD_DIRECTIONS.indexOf(directions.up); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }
        if (action === 'moveDown') { const i = HELD_DIRECTIONS.indexOf(directions.down); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }
        if (action === 'moveLeft') { const i = HELD_DIRECTIONS.indexOf(directions.left); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }
        if (action === 'moveRight') { const i = HELD_DIRECTIONS.indexOf(directions.right); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }

        if (action === 'leaderboard') hideLeaderboard();

        const activePlayer = getActivePlayerInfo();
        if (activePlayer && action === 'grenade' && grenadeCharging) {
            const type = getSelectedGrenadeType();
            const chargePercent = getGrenadeChargePercent();
            grenadeCharging = false;

            const mouseWorld = getMouseWorldPosition();
            const cx = activePlayer.current_position.x + HALF_HIT_BOX;
            const cy = activePlayer.current_position.y + HALF_HIT_BOX;
            const tdx = mouseWorld.x - cx;
            const tdy = mouseWorld.y - cy;
            const dist = Math.sqrt(tdx * tdx + tdy * tdy);
            const aimDx = dist > 0 ? tdx / dist : 0;
            const aimDy = dist > 0 ? tdy / dist : 0;

            getAdapter().sendInput({ type: 'THROW_GRENADE', playerId: activePlayer.id, grenadeType: type, chargePercent, aimDx, aimDy });
            // C4: keep selected so next keydown triggers detonation
            // Other types: only cycle when throwing the last one
            if (type !== 'C4' && activePlayer.grenades[type] <= 1) {
                cycleGrenade(1);
            }
        }
    });

    window.addEventListener('wheel', (e) => {
        if (isBuyMenuOpen()) return;
        cycleGrenade(e.deltaY > 0 ? 1 : -1);
    });
}

/** Whether the primary fire button is currently pressed. Alias for {@link getIsFiring}. */
export function isFiringInput(): boolean {
    return getIsFiring();
}
