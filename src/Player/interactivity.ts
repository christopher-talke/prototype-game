import { ACTIVE_PLAYER, getAllPlayers, getPlayerInfo, getPlayerElement } from '../Globals/Players';
import { getAngle } from '../Utilities/getAngle';
import { angleToRadians } from '../Utilities/angleToRadians';
import { HALF_HIT_BOX, MAP_OFFSET, ROTATION_OFFSET } from '../constants';
import { SETTINGS } from '../Globals/App';
import { detectOtherPlayers } from './detection';
import { environment } from '../Environment/environment';
import { HELD_DIRECTIONS, directions } from './player';
import { generateRayCast, generateFOVCone, hideFOVCone, tickAdaptiveQuality, RaycastTypes } from './Raycast/raycast';
import { toggleSettings, isSettingsOpen, closeSettings } from '../Settings/settings';
import { getActionForKey } from '../Settings/keybinds';
import { initShooting, getActiveWeapon, getIsFiring } from '../Combat/shooting';
import { getAdapter } from '../Net/activeAdapter';
import { updateHUD, toggleBuyMenu, isBuyMenuOpen, closeBuyMenu, updateCrosshairPosition, showLeaderboard, hideLeaderboard, isPauseOpen, openPause, closePause } from '../HUD/hud';
import { isPlayerDead } from '../Combat/damage';
import { getWeaponDef } from '../Combat/weapons';
import { updateAllAI } from '../AI/ai';
import { setMouseWorldPosition, getMouseWorldPosition } from '../Utilities/mouseWorldPosition';
import { updateSmokeClouds } from '../Combat/smoke';
import { clientRenderer } from '../Net/ClientRenderer';
import { initADS, updateAimLine } from './aimline';
import { getConfig } from '../Config/activeConfig';

// Camera aim offset (lerped)
let currentOffsetX = 0;
let currentOffsetY = 0;

// Camera scroll throttling
let lastScrollX = NaN;
let lastScrollY = NaN;

// Cached fog-of-war element (avoid getElementById every frame)
let _cachedFogEl: HTMLElement | null = null;
// Track whether local player classes were set
let _localPlayerClassesSet = false;

// Grenade selection
const GRENADE_ORDER: GrenadeType[] = ['FRAG', 'FLASH', 'SMOKE', 'C4'];
let selectedGrenadeIndex = 0;

/**
 * Gets the currently selected grenade type.
 * @returns The type of the currently selected grenade.
 */
export function getSelectedGrenadeType(): GrenadeType {
    return GRENADE_ORDER[selectedGrenadeIndex];
}

/**
 * Cycles through the available grenades.
 * @param delta The amount to change the selected grenade index by.
 */
function cycleGrenade(delta: number) {
    selectedGrenadeIndex = (((selectedGrenadeIndex + delta) % GRENADE_ORDER.length) + GRENADE_ORDER.length) % GRENADE_ORDER.length;
}

let grenadeChargeStart = 0;
let grenadeCharging = false;

/**
 * Gets the current grenade charge percentage.
 * @returns The current grenade charge percentage, ranging from 0 to 1.
 */
export function getGrenadeChargePercent(): number {
    if (!grenadeCharging) return 0;
    return Math.min(1, (performance.now() - grenadeChargeStart) / getConfig().grenades.chargeTime);
}

/**
 * Adds interactivity to a player's rendered element, including movement, shooting, and grenade handling.
 * @param renderedPlayerElement The HTML element representing the player.
 * @param targetPlayerId The ID of the player for whom to add interactivity.
 */
function getActivePlayerInfo(): player_info | null {
    if (ACTIVE_PLAYER == null) return null;
    return (getPlayerInfo(ACTIVE_PLAYER) as player_info) ?? null;
}

function getActivePlayerElement(): HTMLElement | null {
    if (ACTIVE_PLAYER == null) return null;
    return getPlayerElement(ACTIVE_PLAYER) ?? null;
}

let interactivityInitialized = false;

export function initInteractivity() {
    if (interactivityInitialized) return;
    interactivityInitialized = true;

    initShooting();
    initADS();
    setupInputListeners();
    startGameLoop();
}

function setupInputListeners() {

    window.addEventListener('keydown', (e) => {
        // Settings rebind listener eats keys when listening
        if (isSettingsOpen() && e.key !== 'Escape') return;

        if (e.key === 'Escape') {
            if (isSettingsOpen()) {
                closeSettings();
                return;
            }
            if (isBuyMenuOpen()) {
                closeBuyMenu();
                return;
            }
            if (isPauseOpen()) {
                closePause();
                return;
            }
            openPause();
            return;
        }

        const action = getActionForKey(e.key);
        const menuOpen = isSettingsOpen() || isBuyMenuOpen() || isPauseOpen();
        const activePlayer = getActivePlayerInfo();

        // These always work
        if (action === 'settings') toggleSettings();
        if (activePlayer && action === 'buyMenu') toggleBuyMenu(activePlayer);

        // Everything else blocked while a menu is open
        if (menuOpen) return;

        // Movement
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

        // Grenades - start charging on keydown
        if (activePlayer && action === 'grenade' && !isPlayerDead(activePlayer) && !grenadeCharging) {
            const type = getSelectedGrenadeType();
            if (type === 'C4') {
                // Try detonating first; the sim ignores this if no C4 is placed
                getAdapter().sendInput({ type: 'DETONATE_C4', playerId: activePlayer.id });
            }
            if (activePlayer.grenades[type] > 0) {
                grenadeCharging = true;
                grenadeChargeStart = performance.now();
            }
        }

        const activeEl = getActivePlayerElement();
        if (activeEl) activeEl.setAttribute('moving', 'true');
    });

    window.addEventListener('mousemove', (e) => {
        updateCrosshairPosition(e.clientX, e.clientY);
        const activePlayer = getActivePlayerInfo();
        if (activePlayer) {
            const currentMouseX = e.pageX;
            const currentMouseY = e.pageY;

            // Track world-space mouse position for grenade aiming
            // pageX/pageY already include scroll, so only subtract MAP_OFFSET
            setMouseWorldPosition(currentMouseX - MAP_OFFSET, currentMouseY - MAP_OFFSET);

            const centerX = activePlayer.current_position.x + HALF_HIT_BOX + MAP_OFFSET;
            const centerY = activePlayer.current_position.y + HALF_HIT_BOX + MAP_OFFSET;

            const newRotation = getAngle(centerX, centerY, currentMouseX, currentMouseY) + ROTATION_OFFSET;
            activePlayer.current_position.rotation = newRotation;
            getAdapter().sendInput({ type: 'ROTATE', playerId: activePlayer.id, rotation: newRotation });
        }
    });

    window.addEventListener('keyup', (e) => {
        const action = getActionForKey(e.key);

        if (action === 'moveUp') {
            const i = HELD_DIRECTIONS.indexOf(directions.up);
            if (i > -1) HELD_DIRECTIONS.splice(i, 1);
        }
        if (action === 'moveDown') {
            const i = HELD_DIRECTIONS.indexOf(directions.down);
            if (i > -1) HELD_DIRECTIONS.splice(i, 1);
        }
        if (action === 'moveLeft') {
            const i = HELD_DIRECTIONS.indexOf(directions.left);
            if (i > -1) HELD_DIRECTIONS.splice(i, 1);
        }
        if (action === 'moveRight') {
            const i = HELD_DIRECTIONS.indexOf(directions.right);
            if (i > -1) HELD_DIRECTIONS.splice(i, 1);
        }

        if (action === 'leaderboard') {
            hideLeaderboard();
        }

        // Grenades - release to throw with charge
        const activePlayer = getActivePlayerInfo();
        if (activePlayer && action === 'grenade' && grenadeCharging) {
            const type = getSelectedGrenadeType();
            const chargePercent = getGrenadeChargePercent();
            grenadeCharging = false;

            // Calculate aim direction from player center to mouse world position
            const mouseWorld = getMouseWorldPosition();
            const cx = activePlayer.current_position.x + HALF_HIT_BOX;
            const cy = activePlayer.current_position.y + HALF_HIT_BOX;
            const tdx = mouseWorld.x - cx;
            const tdy = mouseWorld.y - cy;
            const dist = Math.sqrt(tdx * tdx + tdy * tdy);
            const aimDx = dist > 0 ? tdx / dist : 0;
            const aimDy = dist > 0 ? tdy / dist : 0;

            getAdapter().sendInput({ type: 'THROW_GRENADE', playerId: activePlayer.id, grenadeType: type, chargePercent, aimDx, aimDy });
        }

        const activeEl = getActivePlayerElement();
        if (activeEl) activeEl.setAttribute('moving', 'false');
    });

    // Scroll wheel to cycle grenade selection
    window.addEventListener('wheel', (e) => {
        if (isBuyMenuOpen()) return;
        cycleGrenade(e.deltaY > 0 ? 1 : -1);
    });
}


function startGameLoop() {
    let lastTime = 0;
    const targetFrameTime = 1000 / 60; // 60fps target
    function gameLoop(timestamp: number) {
        const deltaTime = timestamp - lastTime;

        if (deltaTime >= targetFrameTime) {
            lastTime = timestamp - (deltaTime % targetFrameTime);

            const loopPlayer = getActivePlayerInfo();
            const loopPlayerEl = getActivePlayerElement();
            if (loopPlayer && loopPlayerEl && window.visualViewport) {
                const adapter = getAdapter();
                const roundRunning = adapter.isRoundActive();

                if (roundRunning && !isPlayerDead(loopPlayer)) {
                    const menuOpen = isSettingsOpen() || isBuyMenuOpen() || isPauseOpen();
                    if (!menuOpen) {
                        const { dx, dy } = getMovementInput();
                        if (dx !== 0 || dy !== 0) {
                            adapter.sendInput({ type: 'MOVE', playerId: loopPlayer.id, dx, dy });
                        }
                        if (getIsFiring()) {
                            adapter.sendInput({ type: 'FIRE', playerId: loopPlayer.id, timestamp });
                        }
                    }
                }

                // Keep ticking while match is active so intermission timers can advance to next round.
                if (adapter.isMatchActive() && !isPauseOpen()) {
                    adapter.tick(environment.segments, getAllPlayers(), timestamp);
                    clientRenderer.updateVisuals();
                    updateSmokeClouds(timestamp);
                }

                if (roundRunning && !isPauseOpen() && adapter.mode === 'offline') {
                    updateAllAI(getAllPlayers(), timestamp);
                }

                const newX = loopPlayer.current_position.x;
                const newY = loopPlayer.current_position.y;
                const newRotation = loopPlayer.current_position.rotation;

                // Camera aim offset
                const weapon = getActiveWeapon(loopPlayer);
                const weaponDef = weapon ? getWeaponDef(weapon.type) : null;
                const cameraOffsetDist = weaponDef ? weaponDef.cameraOffset : 0;
                const facingRad = angleToRadians(newRotation - ROTATION_OFFSET);
                const targetOffsetX = Math.cos(facingRad) * cameraOffsetDist;
                const targetOffsetY = Math.sin(facingRad) * cameraOffsetDist;
                currentOffsetX += (targetOffsetX - currentOffsetX) * 0.18;
                currentOffsetY += (targetOffsetY - currentOffsetY) * 0.18;

                const cameraX = newX + currentOffsetX + MAP_OFFSET - window.visualViewport.width / 2;
                const cameraY = newY + currentOffsetY + MAP_OFFSET - window.visualViewport.height / 2;
                const roundedCX = Math.round(cameraX);
                const roundedCY = Math.round(cameraY);
                if (roundedCX !== lastScrollX || roundedCY !== lastScrollY) {
                    lastScrollX = roundedCX;
                    lastScrollY = roundedCY;
                    window.scrollTo(roundedCX, roundedCY);
                }

                detectOtherPlayers(loopPlayer.id);

                if (SETTINGS.raycast.type === 'MAIN_THREAD') {
                    generateRayCast(loopPlayer, { type: RaycastTypes.CORNERS });
                    hideFOVCone();
                    tickAdaptiveQuality(timestamp);
                } else if (SETTINGS.raycast.type === 'SPRAY') {
                    generateRayCast(loopPlayer, { type: RaycastTypes.SPRAY });
                    hideFOVCone();
                } else {
                    generateFOVCone(loopPlayer);
                    if (!_cachedFogEl) _cachedFogEl = document.getElementById('fog-of-war');
                    _cachedFogEl?.classList.add('d-none');
                }

                // Set once rather than every frame
                if (!_localPlayerClassesSet) {
                    loopPlayerEl.classList.add('visible');
                    loopPlayerEl.classList.remove('same-team-not-visible');
                    _localPlayerClassesSet = true;
                }
                loopPlayerEl.style.transform = `translate3d(${newX}px, ${newY}px, 0) rotate(${newRotation}deg)`;

                updateAimLine(loopPlayer);

                updateHUD(loopPlayer, adapter.getMatchTimeRemaining());
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
}

/**
 * Gets the current movement input based on held directions.
 * @returns An object containing the horizontal (dx) and vertical (dy) movement values.
 */
function getMovementInput(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;

    for (const dir of HELD_DIRECTIONS) {
        if (dir === directions.right) dx = 1;
        if (dir === directions.left) dx = -1;
        if (dir === directions.down) dy = 1;
        if (dir === directions.up) dy = -1;
    }

    // Normalize diagonal so you don't move faster
    if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
    }

    return { dx, dy };
}
