import { ACTIVE_PLAYER, getPlayerInfo } from "../Globals/Players";
import { getAngle } from '../Utilities/getAngle';
import { MAP_OFFSET, ROTATION_OFFSET, SPEED, PLAYER_HIT_BOX } from '../constants';
import { SETTINGS } from '../main';
import { detectOtherPlayers } from './detection';
import { environment } from "../Environment/environment";
import { keys, HELD_DIRECTIONS, directions } from './player';
import { generateRayCast, RaycastTypes } from "./Raycast/raycast";
import { toggleSettings } from "../Settings/settings";

export function addPlayerInteractivity(renderedPlayerElement: HTMLElement, targetPlayerId: number) {
    const playerInfo = getPlayerInfo(targetPlayerId) as player_info;

    window.addEventListener('keydown', (e) => {
        const dir = keys[e.key];
        if (dir && HELD_DIRECTIONS.indexOf(dir) === -1) {
            HELD_DIRECTIONS.unshift(directions[dir]);
        }

        if (e.key.toLowerCase() === 'l') {
            toggleSettings()
        }

        renderedPlayerElement.setAttribute('moving', 'true');
    });

    window.addEventListener('mousemove', (e) => {
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

                movement(playerInfo, deltaTime);

                const newX = playerInfo.current_position.x;
                const newY = playerInfo.current_position.y;
                const newRotation = playerInfo.current_position.rotation;
                const cameraX = (playerInfo.current_position.x + MAP_OFFSET) - window.visualViewport.width / 2;
                const cameraY = (playerInfo.current_position.y + MAP_OFFSET) - window.visualViewport.height / 2;
                window.scrollTo(cameraX, cameraY);

                detectOtherPlayers(playerInfo.id);

                if (SETTINGS.raycast.type !== "DISABLED") {
                    generateRayCast(playerInfo, { type: RaycastTypes.CORNERS })
                }

                renderedPlayerElement.style.transform = `translate3d(${newX}px, ${newY}px, 0) rotate(${newRotation}deg)`;
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
}

function movement(playerInfo: player_info, _deltaTime: number) {
    const held_direction = HELD_DIRECTIONS[0];
    if (held_direction) {
        if (held_direction === directions.right) {
            playerInfo.current_position.x += SPEED;
        }
        if (held_direction === directions.left) {
            playerInfo.current_position.x -= SPEED;
        }
        if (held_direction === directions.down) {
            playerInfo.current_position.y += SPEED;
        }
        if (held_direction === directions.up) {
            playerInfo.current_position.y -= SPEED;
        }
    }

    if (playerInfo.current_position.x < environment.limits.left) {
        playerInfo.current_position.x = environment.limits.left;
    }

    if (playerInfo.current_position.x > environment.limits.right - PLAYER_HIT_BOX) {
        playerInfo.current_position.x = environment.limits.right - PLAYER_HIT_BOX;
    }

    if (playerInfo.current_position.y < environment.limits.top) {
        playerInfo.current_position.y = environment.limits.top;
    }

    if (playerInfo.current_position.y > environment.limits.bottom - PLAYER_HIT_BOX) {
        playerInfo.current_position.y = environment.limits.bottom - PLAYER_HIT_BOX;
    }

    return;
}
