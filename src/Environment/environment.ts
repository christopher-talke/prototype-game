import { generateCollisionMap } from "./generateCollisionMap"

export const environment = {
    limits: {
        left: 0,
        right: 3000,
        top: 0,
        bottom: 3000,
    },
    segments: [],
    corners: [],
    collisions: {},
} as Environment

export function generateEnvironment() {
    environment.collisions = generateCollisionMap(environment);
    environment.corners = [];
    environment.segments = [
        // Environment boundaries
        { x1: environment.limits.left, y1: environment.limits.top, x2: environment.limits.right, y2: environment.limits.top },
        { x1: environment.limits.right, y1: environment.limits.top, x2: environment.limits.right, y2: environment.limits.bottom },
        { x1: environment.limits.right, y1: environment.limits.bottom, x2: environment.limits.left, y2: environment.limits.bottom },
        { x1: environment.limits.left, y1: environment.limits.bottom, x2: environment.limits.left, y2: environment.limits.top },
    ];

    // Extract corners from collision map (legacy, used until Phase 3 removes collision map)
    const cornerSet = new Set<string>();
    Object.entries(environment.collisions).forEach(([coord, collision]) => {
        if (collision.isCorner) {
            cornerSet.add(coord);
        }
    });
    cornerSet.forEach(coord => {
        const [x, y] = coord.split(',');
        environment.corners.push({ x: Number(x), y: Number(y) });
    });

    return;
}
