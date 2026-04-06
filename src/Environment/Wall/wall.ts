import './wall.css';

import { app } from '../../Globals/App';
import { getElementCoordinates } from '../../Utilities/getElementCoordinates';
import { getRandomNumber } from '../../Utilities/getRandomNumber';
import { environment } from '../environment';
import { registerWallAABB } from '../../Player/collision';

export function createWall(wallInfo: wall_info) {
    const newWallEntity = window.document.createElement('div');
    const newWallIdentifier = getRandomNumber(1000, 9999);

    newWallEntity.id = `wall-${newWallIdentifier}`;
    newWallEntity.classList.add(`wall`);
    newWallEntity.setAttribute('data-wall-id', `${newWallIdentifier}`);
    newWallEntity.setAttribute('data-wall-type', wallInfo.type ?? 'concrete');
    newWallEntity.style.width = `${wallInfo.width}px`;
    newWallEntity.style.height = `${wallInfo.height}px`;
    newWallEntity.style.transform = `translate3d(${wallInfo.x}px, ${wallInfo.y}px, 0)`;

    if (wallInfo.sprite) {
        const img = document.createElement('img');
        img.src = wallInfo.sprite;
        img.classList.add('wall-sprite');
        newWallEntity.appendChild(img);
    }

    app.appendChild(newWallEntity);
    registerWallAABB(wallInfo.x, wallInfo.y, wallInfo.width, wallInfo.height);
    addWallToCollisions(newWallEntity);

    return;
}

export function addWallToCollisions(element: HTMLElement) {
    const newCollisions = { ...environment.collisions };

    const coords = getElementCoordinates(element);

    const collisionsToAdd = {} as CollisionMap;
    const corner_collision: Collision = {
        type: 'WALL',
        entity: true,
        ray: true,
        projectile: true,
        isCorner: true,
    };

    const face_collision: Collision = {
        type: 'WALL',
        entity: true,
        ray: true,
        projectile: true,
        isCorner: false,
    };

    const left = Math.floor(coords.left);
    const right = Math.floor(coords.right);
    const top = Math.floor(coords.top);
    const bottom = Math.floor(coords.bottom);

    // Add corner collisions
    collisionsToAdd[`${left},${top}`] = corner_collision;
    collisionsToAdd[`${right},${top}`] = corner_collision;
    collisionsToAdd[`${right},${bottom}`] = corner_collision;
    collisionsToAdd[`${left},${bottom}`] = corner_collision;

    // Add face collisions (top and bottom edges)
    for (let i = left + 1; i < right; i++) {
        collisionsToAdd[`${i},${top}`] = face_collision;
        collisionsToAdd[`${i},${bottom}`] = face_collision;
    }

    // Add face collisions (left and right edges)
    for (let i = top + 1; i < bottom; i++) {
        collisionsToAdd[`${right},${i}`] = face_collision;
        collisionsToAdd[`${left},${i}`] = face_collision;
    }

    environment.collisions = { ...newCollisions, ...collisionsToAdd };

    // Add wall segments
    environment.segments.push({ x1: left, y1: top, x2: right, y2: top }, { x1: right, y1: top, x2: right, y2: bottom }, { x1: right, y1: bottom, x2: left, y2: bottom }, { x1: left, y1: bottom, x2: left, y2: top });

    // Rebuild corners list
    environment.corners = [];
    const cornerSet = new Set<string>();
    Object.entries(environment.collisions).forEach(([coord, collision]) => {
        if (collision.isCorner) {
            cornerSet.add(coord);
        }
    });
    cornerSet.forEach((coord) => {
        const [x, y] = coord.split(',');
        environment.corners.push({ x: Number(x), y: Number(y) });
    });

    return;
}
