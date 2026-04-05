import { ACTIVE_PLAYER, getAllPlayers, getPlayerInfo } from "../Globals/Players";
import { getAngle } from '../Utilities/getAngle';
import { angleToRadians } from '../Utilities/angleToRadians';
import { MAP_OFFSET, ROTATION_OFFSET, SPEED } from '../constants';
import { SETTINGS } from '../main';
import { detectOtherPlayers } from './detection';
import { moveWithCollision } from './collision';
import { environment } from '../Environment/environment';
import { keys, HELD_DIRECTIONS, directions } from './player';
import { generateRayCast, RaycastTypes } from "./Raycast/raycast";
import { toggleSettings } from "../Settings/settings";
import { initShooting, tryFire, startReload, switchWeapon, getActiveWeapon } from "../Combat/shooting";
import { updateProjectiles } from "../Combat/projectiles";
import { checkMatchTimer, getMatchTimeRemaining } from "../Combat/gameState";
import { updateHUD, toggleBuyMenu, isBuyMenuOpen, closeBuyMenu, updateCrosshairPosition } from "../HUD/hud";
import { isPlayerDead } from "../Combat/damage";
import { getWeaponDef } from "../Combat/weapons";
import { updateAllAI } from "../AI/ai";

// Camera aim offset (lerped)
let currentOffsetX = 0;
let currentOffsetY = 0;

export function addPlayerInteractivity(renderedPlayerElement: HTMLElement, targetPlayerId: number) {
    const playerInfo = getPlayerInfo(targetPlayerId) as player_info;

    initShooting(playerInfo);

    window.addEventListener('keydown', (e) => {
        const dir = keys[e.key];
        if (dir && HELD_DIRECTIONS.indexOf(dir) === -1) {
            HELD_DIRECTIONS.unshift(directions[dir]);
        }

        if (e.key.toLowerCase() === 'l') {
            toggleSettings()
        }

        // Reload
        if (e.key.toLowerCase() === 'r') {
            startReload(playerInfo);
        }

        // Weapon switch
        if (e.key === '1') switchWeapon(playerInfo, 0);
        if (e.key === '2') switchWeapon(playerInfo, 1);
        if (e.key === '3') switchWeapon(playerInfo, 2);

        // Buy menu
        if (e.key.toLowerCase() === 'b') {
            toggleBuyMenu(playerInfo);
        }
        if (e.key === 'Escape' && isBuyMenuOpen()) {
            closeBuyMenu();
        }

        renderedPlayerElement.setAttribute('moving', 'true');
    });

    window.addEventListener('mousemove', (e) => {
        updateCrosshairPosition(e.clientX, e.clientY);
        if (playerInfo) {
            const currentMouseX = e.pageX;
            const currentMouseY = e.pageY;

            const pointerBox = renderedPlayerElement.getBoundingClientRect();
            const centerPoint = window.getComputedStyle(renderedPlayerElement).transformOrigin;
            const centers = centerPoint.split(" ");
            const centerY = pointerBox.top + parseInt(centers[1]) + scrollY;
            const centerX = pointerBox.left + parseInt(centers[0]) + scrollX;

            playerInfo.current_position.rotation = getAngle(centerX, centerY, currentMouseX, currentMouseY) + ROTATION_OFFSET;
        }
    });

    window.addEventListener('keyup', (e) => {
        const dir = keys[e.key];
        const index = HELD_DIRECTIONS.indexOf(dir as string);
        if (index > -1) {
            HELD_DIRECTIONS.splice(index, 1);
        }

        renderedPlayerElement.setAttribute('moving', 'false');
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

                if (!isPlayerDead(playerInfo)) {
                    movement(playerInfo, deltaTime);
                    tryFire(playerInfo, timestamp);
                }

                updateProjectiles(environment.segments, getAllPlayers());
                updateAllAI(getAllPlayers(), timestamp);

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
                currentOffsetX += (targetOffsetX - currentOffsetX) * 0.08;
                currentOffsetY += (targetOffsetY - currentOffsetY) * 0.08;

                const cameraX = (newX + currentOffsetX + MAP_OFFSET) - window.visualViewport.width / 2;
                const cameraY = (newY + currentOffsetY + MAP_OFFSET) - window.visualViewport.height / 2;
                window.scrollTo(cameraX, cameraY);

                detectOtherPlayers(playerInfo.id);

                if (SETTINGS.raycast.type !== "DISABLED") {
                    generateRayCast(playerInfo, { type: RaycastTypes.CORNERS })
                }

                renderedPlayerElement.style.transform = `translate3d(${newX}px, ${newY}px, 0) rotate(${newRotation}deg)`;

                updateHUD(playerInfo, getMatchTimeRemaining());
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
}

function movement(playerInfo: player_info, _deltaTime: number) {
    const held_direction = HELD_DIRECTIONS[0];
    let dx = 0;
    let dy = 0;

    if (held_direction) {
        if (held_direction === directions.right) dx = SPEED;
        if (held_direction === directions.left) dx = -SPEED;
        if (held_direction === directions.down) dy = SPEED;
        if (held_direction === directions.up) dy = -SPEED;
    }

    if (dx === 0 && dy === 0) return;

    const result = moveWithCollision(
        playerInfo.current_position.x,
        playerInfo.current_position.y,
        dx, dy
    );
    playerInfo.current_position.x = result.x;
    playerInfo.current_position.y = result.y;
}
