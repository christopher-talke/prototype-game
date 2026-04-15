/**
 * Shipment map data -- compact container yard (~1600x1600 interior).
 * Tight lanes between shipping containers force constant close-quarters combat.
 * Symmetric east-west spawns with mirrored cover placement.
 */
export const Shipment: MapData = {
    lighting: { ambientLight: 0.25, ambientColor: 0x121620 },
    lights: [],
    patrolPoints: [
        // North lane (east-west)
        { x: 1000, y: 880 },
        { x: 1500, y: 880 },
        { x: 2000, y: 880 },

        // Center area
        { x: 1000, y: 1500 },
        { x: 1500, y: 1350 },
        { x: 2000, y: 1500 },

        // South lane (east-west)
        { x: 1000, y: 2080 },
        { x: 1500, y: 2080 },
        { x: 2000, y: 2080 },

        // North-south lanes
        { x: 850, y: 1200 },
        { x: 2150, y: 1200 },
        { x: 1500, y: 1700 },
    ],
    teamSpawns: {
        1: [
            { x: 830, y: 1300 },
            { x: 830, y: 1700 },
        ],
        2: [
            { x: 2120, y: 1300 },
            { x: 2120, y: 1700 },
        ],
    },
    walls: [
        // Boundary (thick metal container walls, fully enclosed)
        { x: 700, y: 700, width: 1600, height: 80, type: 'metal' },
        { x: 700, y: 2220, width: 1600, height: 80, type: 'metal' },
        { x: 700, y: 780, width: 80, height: 1440, type: 'metal' },
        { x: 2220, y: 780, width: 80, height: 1440, type: 'metal' },

        // Interior containers - row 1 (upper third)
        { x: 900, y: 960, width: 280, height: 120, type: 'crate' },
        { x: 1820, y: 960, width: 280, height: 120, type: 'crate' },

        // Interior containers - row 2 (center band)
        { x: 1100, y: 1280, width: 120, height: 280, type: 'crate' },
        { x: 1360, y: 1440, width: 280, height: 120, type: 'crate' },
        { x: 1780, y: 1280, width: 120, height: 280, type: 'crate' },

        // Interior containers - row 3 (lower third)
        { x: 900, y: 1920, width: 280, height: 120, type: 'crate' },
        { x: 1820, y: 1920, width: 280, height: 120, type: 'crate' },
        { x: 1440, y: 1700, width: 120, height: 200, type: 'crate' },

        // Sandbags in lane midpoints
        { x: 1440, y: 900, width: 60, height: 60, type: 'sandbag' },
        { x: 1440, y: 2080, width: 60, height: 60, type: 'sandbag' },
        { x: 850, y: 1440, width: 60, height: 60, type: 'sandbag' },
        { x: 2100, y: 1440, width: 60, height: 60, type: 'sandbag' },

        // Corner barriers
        { x: 820, y: 820, width: 50, height: 50, type: 'barrier' },
        { x: 2130, y: 820, width: 50, height: 50, type: 'barrier' },
        { x: 820, y: 2130, width: 50, height: 50, type: 'barrier' },
        { x: 2130, y: 2130, width: 50, height: 50, type: 'barrier' },
    ],
};
