import { ACTIVE_PLAYER, getAllPlayers, getPlayerInfo } from './player/playerRegistry';
import { getPlayerElement } from '@rendering/playerElements';
import { SETTINGS } from '../app';
import { environment } from '@simulation/environment/environment';
import { initShooting } from '@simulation/combat/shooting';
import { isPlayerDead } from '@simulation/combat/damage';
import { getAdapter } from '@net/activeAdapter';
import { updateAllAI } from '@ai/index';
import { initADS } from '@rendering/dom/aimLineRenderer';
import { isPauseOpen } from '@rendering/dom/hud';
import { initInputController, getMovementInput, isFiringInput, isMenuOpen } from './inputController';
import { updateRenderPipeline } from '@rendering/renderPipeline';

let initialized = false;

export function initGameLoop() {
    if (initialized) return;
    initialized = true;

    initShooting();
    initADS();
    initInputController();
    startLoop();
}

function getActivePlayerInfo(): player_info | null {
    if (ACTIVE_PLAYER == null) return null;
    return (getPlayerInfo(ACTIVE_PLAYER) as player_info) ?? null;
}

function getActivePlayerElement(): HTMLElement | null {
    if (ACTIVE_PLAYER == null) return null;
    return getPlayerElement(ACTIVE_PLAYER) ?? null;
}

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
                    updateRenderPipeline(player, adapter, timestamp);
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
