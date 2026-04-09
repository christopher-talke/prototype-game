import '../simulation/environment/wall/wall.css';

import { app } from '../app';
import { getRandomNumber } from '../utils/getRandomNumber';
import { cssTransform } from './cssTransform';

export function renderWall(wallInfo: wall_info) {
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
