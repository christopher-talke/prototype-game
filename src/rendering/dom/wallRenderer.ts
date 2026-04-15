/**
 * DOM wall renderer. Creates positioned/rotated div elements for each wall
 * segment, with optional sprite images. Part of the DOM rendering layer.
 */

import '@rendering/dom/css/wall.css';

import { app } from '../../app';
import { getRandomNumber } from '@utils/getRandomNumber';
import { cssTransform } from '@rendering/dom/cssTransform';

/**
 * Removes all wall DOM elements from the game container.
 */
export function clearRenderedWalls() {
    if (app === undefined) return;
    app.querySelectorAll('.wall').forEach((el) => el.remove());
}

/**
 * Creates a wall DOM element positioned and sized according to the wall definition.
 * Appends an img child if the wall has a sprite.
 * @param wallInfo - Wall definition containing position, dimensions, type, and optional sprite
 */
export function renderWall(wallInfo: wall_info) {
    if (app === undefined) return;

    const newWallEntity = window.document.createElement('div');
    const newWallIdentifier = getRandomNumber(1000, 9999);

    newWallEntity.id = `wall-${newWallIdentifier}`;
    newWallEntity.classList.add(`wall`);
    newWallEntity.setAttribute('data-wall-id', `${newWallIdentifier}`);
    newWallEntity.setAttribute('data-wall-type', wallInfo.type ?? 'concrete');
    newWallEntity.style.width = `${wallInfo.width}px`;
    newWallEntity.style.height = `${wallInfo.height}px`;
    newWallEntity.style.transform = cssTransform(wallInfo.x, wallInfo.y);

    if (wallInfo.sprite) {
        const img = document.createElement('img');
        img.src = wallInfo.sprite;
        img.classList.add('wall-sprite');
        newWallEntity.appendChild(img);
    }

    app.appendChild(newWallEntity);
}
