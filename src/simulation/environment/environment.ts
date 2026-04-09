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
 * Generates the environment segments and corners based on the defined limits. 
 * This is called once at the start of the game to set up the environment data structure, which is used for raycasting and visibility calculations.
 */
export function generateEnvironment() {
    const { left, right, top, bottom } = environment.limits;

    environment.segments = [
        { x1: left, y1: top, x2: right, y2: top },
        { x1: right, y1: top, x2: right, y2: bottom },
        { x1: right, y1: bottom, x2: left, y2: bottom },
        { x1: left, y1: bottom, x2: left, y2: top },
    ];

    environment.corners = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
    ];
}

export function clearWallGeometry() {
    generateEnvironment();
}
