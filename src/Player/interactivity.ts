import { ACTIVE_PLAYER, getAllPlayers, getPlayerInfo } from "../Globals/Players";
import { getAngle } from '../Utilities/getAngle';
import { angleToRadians } from '../Utilities/angleToRadians';
import { HALF_HIT_BOX, MAP_OFFSET, ROTATION_OFFSET, SPEED } from '../constants';
import { SETTINGS } from '../main';
import { detectOtherPlayers } from './detection';
import { moveWithCollision } from './collision';
import { environment } from '../Environment/environment';
import { HELD_DIRECTIONS, directions } from './player';
import { generateRayCast, RaycastTypes } from "./Raycast/raycast";
import { toggleSettings, isSettingsOpen, closeSettings } from "../Settings/settings";
import { getActionForKey } from "../Settings/keybinds";
import { initShooting, tryFire, startReload, switchWeapon, getActiveWeapon } from "../Combat/shooting";
import { updateProjectiles } from "../Combat/projectiles";
import { checkMatchTimer, getMatchTimeRemaining, isRoundActive } from "../Combat/gameState";
import { updateHUD, toggleBuyMenu, isBuyMenuOpen, closeBuyMenu, updateCrosshairPosition, showLeaderboard, hideLeaderboard } from "../HUD/hud";
import { isPlayerDead } from "../Combat/damage";
import { getWeaponDef } from "../Combat/weapons";
import { updateAllAI } from "../AI/ai";
import { playFootstep } from "../Audio/audio";
import { throwGrenade, updateGrenades, detonateC4, hasPlacedC4, setMouseWorldPosition } from "../Combat/grenadeProjectiles";
import { updateSmokeClouds } from "../Combat/smoke";import { initADS, updateAimLine } from './aimline';
// Camera aim offset (lerped)
let currentOffsetX = 0;
let currentOffsetY = 0;

// Grenade selection
const GRENADE_ORDER: GrenadeType[] = ['FRAG', 'FLASH', 'SMOKE', 'C4'];
let selectedGrenadeIndex = 0;

export function getSelectedGrenadeType(): GrenadeType {
    return GRENADE_ORDER[selectedGrenadeIndex];
}

function cycleGrenade(delta: number) {
    selectedGrenadeIndex = ((selectedGrenadeIndex + delta) % GRENADE_ORDER.length + GRENADE_ORDER.length) % GRENADE_ORDER.length;
}

export function addPlayerInteractivity(renderedPlayerElement: HTMLElement, targetPlayerId: number) {
    const playerInfo = getPlayerInfo(targetPlayerId) as player_info;

    initShooting(playerInfo);
    initADS();

    window.addEventListener('keydown', (e) => {
        // Settings rebind listener eats keys when listening
        if (isSettingsOpen() && e.key !== 'Escape') return;

        if (e.key === 'Escape') {
            if (isSettingsOpen()) { closeSettings(); return; }
            if (isBuyMenuOpen()) { closeBuyMenu(); return; }
        }

        const action = getActionForKey(e.key);
        const menuOpen = isSettingsOpen() || isBuyMenuOpen();

        // These always work
        if (action === 'settings') toggleSettings();
        if (action === 'buyMenu') toggleBuyMenu(playerInfo);

        // Everything else blocked while a menu is open
        if (menuOpen) return;

        // Movement
        if (action === 'moveUp' && HELD_DIRECTIONS.indexOf(directions.up) === -1) HELD_DIRECTIONS.unshift(directions.up);
        if (action === 'moveDown' && HELD_DIRECTIONS.indexOf(directions.down) === -1) HELD_DIRECTIONS.unshift(directions.down);
        if (action === 'moveLeft' && HELD_DIRECTIONS.indexOf(directions.left) === -1) HELD_DIRECTIONS.unshift(directions.left);
        if (action === 'moveRight' && HELD_DIRECTIONS.indexOf(directions.right) === -1) HELD_DIRECTIONS.unshift(directions.right);

        if (action === 'reload') startReload(playerInfo);
        if (action === 'weapon1') switchWeapon(playerInfo, 0);
        if (action === 'weapon2') switchWeapon(playerInfo, 1);
        if (action === 'weapon3') switchWeapon(playerInfo, 2);

        if (action === 'leaderboard') {
            e.preventDefault();
            showLeaderboard();
        }

        // Grenades
        if (action === 'grenade' && !isPlayerDead(playerInfo)) {
            const type = getSelectedGrenadeType();
            if (type === 'C4' && hasPlacedC4(playerInfo.id)) {
                detonateC4(playerInfo.id);
            } else if (playerInfo.grenades[type] > 0) {
                playerInfo.grenades[type]--;
                throwGrenade(type, playerInfo);
            }
        }

        renderedPlayerElement.setAttribute('moving', 'true');
    });

    window.addEventListener('mousemove', (e) => {
        updateCrosshairPosition(e.clientX, e.clientY);
        if (playerInfo) {
            const currentMouseX = e.pageX;
            const currentMouseY = e.pageY;

            // Track world-space mouse position for grenade aiming
            setMouseWorldPosition(currentMouseX + scrollX - MAP_OFFSET, currentMouseY + scrollY - MAP_OFFSET);

            const centerX = playerInfo.current_position.x + HALF_HIT_BOX + MAP_OFFSET;
            const centerY = playerInfo.current_position.y + HALF_HIT_BOX + MAP_OFFSET;

            playerInfo.current_position.rotation = getAngle(centerX, centerY, currentMouseX, currentMouseY) + ROTATION_OFFSET;
        }
    });

    window.addEventListener('keyup', (e) => {
        const action = getActionForKey(e.key);

        if (action === 'moveUp') { const i = HELD_DIRECTIONS.indexOf(directions.up); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }
        if (action === 'moveDown') { const i = HELD_DIRECTIONS.indexOf(directions.down); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }
        if (action === 'moveLeft') { const i = HELD_DIRECTIONS.indexOf(directions.left); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }
        if (action === 'moveRight') { const i = HELD_DIRECTIONS.indexOf(directions.right); if (i > -1) HELD_DIRECTIONS.splice(i, 1); }

        if (action === 'leaderboard') {
            hideLeaderboard();
        }

        renderedPlayerElement.setAttribute('moving', 'false');
    });

    // Scroll wheel to cycle grenade selection
    window.addEventListener('wheel', (e) => {
        if (isBuyMenuOpen()) return;
        cycleGrenade(e.deltaY > 0 ? 1 : -1);
    });

    // Game loop using requestAnimationFrame for proper frame timing
    let lastTime = 0;
    const targetFrameTime = 1000 / 60; // 60fps target

    function gameLoop(timestamp: number) {
        const deltaTime = timestamp - lastTime;

        if (deltaTime >= targetFrameTime) {
            lastTime = timestamp - (deltaTime % targetFrameTime);

            if (playerInfo && ACTIVE_PLAYER === playerInfo.id && window.visualViewport) {

                checkMatchTimer();
                const roundRunning = isRoundActive();

                if (roundRunning && !isPlayerDead(playerInfo)) {
                    const menuOpen = isSettingsOpen() || isBuyMenuOpen();
                    if (!menuOpen) {
                        movement(playerInfo, deltaTime);
                        tryFire(playerInfo, timestamp);
                    }
                }

                if (roundRunning) {
                    updateProjectiles(environment.segments, getAllPlayers());
                    updateGrenades(environment.segments, getAllPlayers(), timestamp);
                    updateSmokeClouds(timestamp);
                    updateAllAI(getAllPlayers(), timestamp);
                }

                const newX = playerInfo.current_position.x;
                const newY = playerInfo.current_position.y;
                const newRotation = playerInfo.current_position.rotation;

                // Camera aim offset
                const weapon = getActiveWeapon(playerInfo);
                const weaponDef = weapon ? getWeaponDef(weapon.type) : null;
                const cameraOffsetDist = weaponDef ? weaponDef.cameraOffset : 0;
                const facingRad = angleToRadians(newRotation - ROTATION_OFFSET);
                const targetOffsetX = Math.cos(facingRad) * cameraOffsetDist;
                const targetOffsetY = Math.sin(facingRad) * cameraOffsetDist;
                currentOffsetX += (targetOffsetX - currentOffsetX) * 0.18;
                currentOffsetY += (targetOffsetY - currentOffsetY) * 0.18;

                const cameraX = (newX + currentOffsetX + MAP_OFFSET) - window.visualViewport.width / 2;
                const cameraY = (newY + currentOffsetY + MAP_OFFSET) - window.visualViewport.height / 2;
                window.scrollTo(cameraX, cameraY);

                detectOtherPlayers(playerInfo.id);

                if (SETTINGS.raycast.type !== "DISABLED") {
                    generateRayCast(playerInfo, { type: RaycastTypes.CORNERS })
                }

                renderedPlayerElement.style.transform = `translate3d(${newX}px, ${newY}px, 0) rotate(${newRotation}deg)`;

                updateAimLine(playerInfo);

                updateHUD(playerInfo, getMatchTimeRemaining());
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
}

function movement(playerInfo: player_info, _deltaTime: number) {
    let dx = 0;
    let dy = 0;

    for (const dir of HELD_DIRECTIONS) {
        if (dir === directions.right) dx = 1;
        if (dir === directions.left) dx = -1;
        if (dir === directions.down) dy = 1;
        if (dir === directions.up) dy = -1;
    }

    if (dx === 0 && dy === 0) return;

    // Normalize diagonal so you don't move faster
    if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
    }

    dx *= SPEED;
    dy *= SPEED;

    if (dx === 0 && dy === 0) return;

    const result = moveWithCollision(
        playerInfo.current_position.x,
        playerInfo.current_position.y,
        dx, dy
    );

    // Play footstep if actually moved
    if (result.x !== playerInfo.current_position.x || result.y !== playerInfo.current_position.y) {
        playFootstep(playerInfo, performance.now());
    }

    playerInfo.current_position.x = result.x;
    playerInfo.current_position.y = result.y;
}
