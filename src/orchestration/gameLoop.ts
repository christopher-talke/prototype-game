/**
 * Main game loop - owns the requestAnimationFrame cycle.
 *
 * Orchestration layer - the outermost ring. Each frame: gathers player input,
 * sends it through the active {@link NetAdapter}, ticks the adapter, runs
 * detection, and calls the render pipeline. AI is updated only in offline
 * mode.
 */

import { ACTIVE_PLAYER, getAllPlayers, getPlayerInfo } from '@simulation/player/playerRegistry';
import { getPlayerElement } from '@rendering/playerElements';
import { SETTINGS } from '../app';
import { environment } from '@simulation/environment/environment';
import { isPlayerDead } from '@simulation/combat/damage';
import { getAdapter } from '@net/activeAdapter';
import { updateAllAI } from '@ai/index';
import { initADS } from '@rendering/dom/aimLineRenderer';
import { isPauseOpen } from '@rendering/dom/hud';
import { initInputController, initShooting, getMovementInput, isFiringInput, isMenuOpen, getGrenadeChargePercent, getSelectedGrenadeType } from '@orchestration/inputController';
import { removeExpiredSmoke } from '@simulation/combat/smokeData';
import { detectOtherPlayers } from '@simulation/detection/detection';
import { updateRenderPipeline } from '@rendering/renderPipeline';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getWeaponDef } from '@simulation/combat/weapons';

let initialized = false;

/**
 * Initializes the game loop and all input subsystems. Safe to call multiple
 * times - subsequent calls are no-ops.
 */
export function initGameLoop() {
    if (initialized) return;
    initialized = true;

    initShooting();
    initADS();
    initInputController();
    startLoop();
}

/**
 * Returns the player_info for the locally controlled player, or null if
 * no active player is set.
 */
function getActivePlayerInfo(): player_info | null {
    if (ACTIVE_PLAYER == null) return null;
    return (getPlayerInfo(ACTIVE_PLAYER) as player_info) ?? null;
}

/**
 * Returns the DOM element for the locally controlled player, or null.
 * Only relevant when using the DOM renderer.
 */
function getActivePlayerElement(): HTMLElement | null {
    if (ACTIVE_PLAYER == null) return null;
    return getPlayerElement(ACTIVE_PLAYER) ?? null;
}

/**
 * Starts the requestAnimationFrame loop. Each frame is rate-limited to
 * ~60 fps. Within each frame: sends movement and fire inputs, ticks the
 * adapter, removes expired smoke, runs player detection, computes camera
 * offset, and updates the render pipeline.
 */
function startLoop() {
    let lastTime = 0;
    const targetFrameTime = 1000 / 60;

    function gameLoop(timestamp: number) {
        const deltaTime = timestamp - lastTime;

        if (deltaTime >= targetFrameTime) {
            lastTime = timestamp - (deltaTime % targetFrameTime);

            const player = getActivePlayerInfo();
            const playerEl = getActivePlayerElement();
            if (player && (SETTINGS.renderer === 'pixi' || playerEl) && window.visualViewport) {
                const adapter = getAdapter();
                const roundRunning = adapter.isRoundActive();

                if (roundRunning && !isPlayerDead(player)) {
                    if (!isMenuOpen()) {
                        const { dx, dy } = getMovementInput();
                        if (dx !== 0 || dy !== 0) {
                            adapter.sendInput({ type: 'MOVE', playerId: player.id, dx, dy });
                        }

                        if (isFiringInput()) {
                            adapter.sendInput({ type: 'FIRE', playerId: player.id, timestamp });
                        }
                    }
                }

                if (adapter.isMatchActive() && !isPauseOpen()) {
                    adapter.tick(environment.segments, getAllPlayers(), timestamp);
                    removeExpiredSmoke(timestamp);
                    const detections = detectOtherPlayers(player.id);
                    const weapon = getActiveWeapon(player);
                    const weaponDef = weapon ? getWeaponDef(weapon.type) : null;
                    const cameraOffset = weaponDef ? weaponDef.cameraOffset : 0;
                    updateRenderPipeline(player, adapter, timestamp, detections, cameraOffset, getGrenadeChargePercent(), getSelectedGrenadeType());
                }

                if (roundRunning && !isPauseOpen() && adapter.mode === 'offline') {
                    updateAllAI(getAllPlayers(), timestamp);
                }
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
}
