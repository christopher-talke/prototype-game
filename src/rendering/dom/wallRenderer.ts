/**
 * DOM wall renderer. Creates positioned/rotated div elements for each wall
 * segment, with optional sprite images. Part of the DOM rendering layer.
 */

import '@rendering/dom/css/wall.css';

import type { Wall } from '@shared/map/MapData';
import { wallAABB } from '@orchestration/bootstrap/mapAccessors';
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
 * Creates a wall DOM element positioned and sized according to the wall's
 * axis-aligned bounding box (derived from polygon vertices).
 * @param wall - Wall definition from the map config.
 */
export function renderWall(wall: Wall) {
    if (app === undefined) return;

    const aabb = wallAABB(wall);
    const newWallEntity = window.document.createElement('div');
    const newWallIdentifier = getRandomNumber(1000, 9999);

    newWallEntity.id = `wall-${newWallIdentifier}`;
    newWallEntity.classList.add(`wall`);
    newWallEntity.setAttribute('data-wall-id', `${newWallIdentifier}`);
    newWallEntity.setAttribute('data-wall-type', wall.wallType);
    newWallEntity.style.width = `${aabb.width}px`;
    newWallEntity.style.height = `${aabb.height}px`;
    newWallEntity.style.transform = cssTransform(aabb.x, aabb.y);

    app.appendChild(newWallEntity);
}
