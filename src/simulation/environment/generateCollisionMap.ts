import { app } from '../../app';

export function generateCollisionMap(environment: Environment): CollisionMap {
    const collisionMap = {} as CollisionMap;

    const corner_collision: Collision = {
        type: 'WALL',
        entity: true,
        ray: true,
        projectile: true,
        isCorner: true,
    };

    collisionMap[`${environment.limits.left},${environment.limits.top}`] = corner_collision;
    collisionMap[`${environment.limits.right},${environment.limits.top}`] = corner_collision;
    collisionMap[`${environment.limits.right},${environment.limits.bottom}`] = corner_collision;
    collisionMap[`${environment.limits.left},${environment.limits.bottom}`] = corner_collision;

    return { ...collisionMap, ...environment.collisions };
}

export function drawCollisionOverlay(environment: Environment) {
    function getNode(n: string, v: Record<string, string | number>) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', n) as SVGAElement;
        for (const p in v) {
            s.setAttributeNS(
                null,
                p.replace(/[A-Z]/g, function (m) {
                    return '-' + m.toLowerCase();
                }),
                String(v[p]),
            );
        }
        return s;
    }

    const svg = getNode('svg', { id: 'collision-overlay', width: environment.limits.right, height: environment.limits.bottom });
    app.appendChild(svg);

    const coordinates = Object.keys(environment.collisions);
    for (let i = 0; i < coordinates.length; i++) {
        const [x, y] = coordinates[i].split(',');

        const svgConfig = { id: `collision-${x}-${y}`, x, y, width: 1, height: 1, fill: '#ff00ff' };
        const r = getNode('rect', svgConfig);
        svg.appendChild(r);
    }
}
