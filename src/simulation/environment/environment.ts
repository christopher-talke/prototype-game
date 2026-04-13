export const environment = {
    limits: {
        left: 0,
        right: 3000,
        top: 0,
        bottom: 3000,
    },
    segments: [],
    corners: [],
} as Environment;

/**
 * Creates a wall segment with the given coordinates.
 * @param x1 - The x-coordinate of the start point.
 * @param y1 - The y-coordinate of the start point.
 * @param x2 - The x-coordinate of the end point.
 * @param y2 - The y-coordinate of the end point.
 * @returns A WallSegment object representing the segment.
 */
export function makeSegment(x1: number, y1: number, x2: number, y2: number): WallSegment {
    return {
        x1, y1, x2, y2,
        minX: Math.min(x1, x2), minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2), maxY: Math.max(y1, y2),
    };
}

/**
 * Generates the environment segments and corners based on the defined limits. 
 * This is called once at the start of the game to set up the environment data structure, which is used for raycasting and visibility calculations.
 */
export function generateEnvironment() {
    const { left, right, top, bottom } = environment.limits;

    environment.segments = [
        makeSegment(left, top, right, top),
        makeSegment(right, top, right, bottom),
        makeSegment(right, bottom, left, bottom),
        makeSegment(left, bottom, left, top),
    ];

    environment.corners = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
    ];
}

export function setEnvironmentLimits(width: number, height: number) {
    environment.limits.right = width;
    environment.limits.bottom = height;
    generateEnvironment();
}

export function clearWallGeometry() {
    generateEnvironment();
}
