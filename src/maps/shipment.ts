export const Shipment: MapData = {
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
        // === BOUNDARY (thick metal container walls, fully enclosed) ===
        // North wall
        { x: 700, y: 700, width: 1600, height: 80, type: 'metal' },
        // South wall
        { x: 700, y: 2220, width: 1600, height: 80, type: 'metal' },
        // West wall (solid)
        { x: 700, y: 780, width: 80, height: 1440, type: 'metal' },
        // East wall (solid)
        { x: 2220, y: 780, width: 80, height: 1440, type: 'metal' },

        // === INTERIOR CONTAINERS ===
        // Row 1 (upper third)
        { x: 900, y: 960, width: 280, height: 120, type: 'crate' },   // upper-left
        { x: 1820, y: 960, width: 280, height: 120, type: 'crate' },  // upper-right

        // Row 2 (center band)
        { x: 1100, y: 1280, width: 120, height: 280, type: 'crate' }, // vertical, left of center
        { x: 1360, y: 1440, width: 280, height: 120, type: 'crate' }, // horizontal, dead center
        { x: 1780, y: 1280, width: 120, height: 280, type: 'crate' }, // vertical, right of center

        // Row 3 (lower third)
        { x: 900, y: 1920, width: 280, height: 120, type: 'crate' },  // lower-left
        { x: 1820, y: 1920, width: 280, height: 120, type: 'crate' }, // lower-right
        { x: 1440, y: 1700, width: 120, height: 200, type: 'crate' }, // vertical, center-bottom

        // === SMALL COVER ===
        // Sandbags in lane midpoints
        { x: 1440, y: 900, width: 60, height: 60, type: 'sandbag' },  // top-center
        { x: 1440, y: 2080, width: 60, height: 60, type: 'sandbag' }, // bottom-center
        { x: 850, y: 1440, width: 60, height: 60, type: 'sandbag' },  // left-center
        { x: 2100, y: 1440, width: 60, height: 60, type: 'sandbag' }, // right-center

        // Corner barriers
        { x: 820, y: 820, width: 50, height: 50, type: 'barrier' },   // NW
        { x: 2130, y: 820, width: 50, height: 50, type: 'barrier' },  // NE
        { x: 820, y: 2130, width: 50, height: 50, type: 'barrier' },  // SW
        { x: 2130, y: 2130, width: 50, height: 50, type: 'barrier' }, // SE
    ],
};
