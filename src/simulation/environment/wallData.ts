import { environment } from './environment';
import { registerWallAABB } from '@simulation/player/collision';

export function registerWallGeometry(wallInfo: wall_info) {
    const { x, y, width, height } = wallInfo;
    registerWallAABB(x, y, width, height);
    addWallToCollisions(x, y, width, height);
}

function addWallToCollisions(x: number, y: number, width: number, height: number) {
    const newCollisions = { ...environment.collisions };

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

    const left = Math.floor(x);
    const right = Math.floor(x + width);
    const top = Math.floor(y);
    const bottom = Math.floor(y + height);

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
    (Object.entries(environment.collisions) as [string, Collision][]).forEach(([coord, collision]) => {
        if (collision.isCorner) {
            cornerSet.add(coord);
        }
    });
    cornerSet.forEach((coord) => {
        const [x, y] = coord.split(',');
        environment.corners.push({ x: Number(x), y: Number(y) });
    });
}
