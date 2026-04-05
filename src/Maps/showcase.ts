// LOSShowcase - dense object placement to stress-test line of sight
// 3000x3000 play area, objects scattered throughout to create interesting shadows

export const LOSShowcase: wall_info[] = [

    // === BOUNDARY ===
    { x: 100, y: 100, width: 2800, height: 15, type: 'concrete' },
    { x: 100, y: 2885, width: 2800, height: 15, type: 'concrete' },
    { x: 100, y: 100, width: 15, height: 2800, type: 'concrete' },
    { x: 2885, y: 100, width: 15, height: 2800, type: 'concrete' },

    // === OUTER RING OF ROOMS ===

    // Top-left room
    { x: 150, y: 150, width: 400, height: 15, type: 'concrete' },
    { x: 150, y: 150, width: 15, height: 400, type: 'concrete' },
    { x: 150, y: 535, width: 180, height: 15, type: 'concrete' },
    { x: 385, y: 535, width: 165, height: 15, type: 'concrete' },
    { x: 535, y: 150, width: 15, height: 180, type: 'concrete' },
    { x: 535, y: 385, width: 15, height: 165, type: 'concrete' },
    // Crates inside
    { x: 200, y: 200, width: 60, height: 60, type: 'crate' },
    { x: 320, y: 200, width: 40, height: 40, type: 'crate' },
    { x: 420, y: 300, width: 70, height: 50, type: 'crate' },
    { x: 200, y: 420, width: 50, height: 50, type: 'crate' },
    { x: 290, y: 380, width: 80, height: 30, type: 'crate' },

    // Top-right room
    { x: 2450, y: 150, width: 440, height: 15, type: 'concrete' },
    { x: 2450, y: 150, width: 15, height: 180, type: 'concrete' },
    { x: 2450, y: 385, width: 15, height: 165, type: 'concrete' },
    { x: 2875, y: 150, width: 15, height: 400, type: 'concrete' },
    { x: 2450, y: 535, width: 165, height: 15, type: 'concrete' },
    { x: 2670, y: 535, width: 220, height: 15, type: 'concrete' },
    // Crates inside
    { x: 2510, y: 200, width: 70, height: 50, type: 'crate' },
    { x: 2700, y: 200, width: 50, height: 70, type: 'crate' },
    { x: 2620, y: 360, width: 60, height: 60, type: 'crate' },
    { x: 2800, y: 420, width: 50, height: 50, type: 'crate' },

    // Bottom-left room
    { x: 150, y: 2450, width: 15, height: 440, type: 'concrete' },
    { x: 535, y: 2450, width: 15, height: 440, type: 'concrete' },
    { x: 150, y: 2450, width: 180, height: 15, type: 'concrete' },
    { x: 385, y: 2450, width: 165, height: 15, type: 'concrete' },
    { x: 150, y: 2875, width: 400, height: 15, type: 'concrete' },
    // Crates
    { x: 200, y: 2510, width: 60, height: 50, type: 'crate' },
    { x: 380, y: 2540, width: 40, height: 70, type: 'crate' },
    { x: 220, y: 2700, width: 80, height: 40, type: 'crate' },
    { x: 420, y: 2700, width: 50, height: 60, type: 'crate' },

    // Bottom-right room
    { x: 2450, y: 2450, width: 15, height: 180, type: 'concrete' },
    { x: 2450, y: 2685, width: 15, height: 205, type: 'concrete' },
    { x: 2875, y: 2450, width: 15, height: 440, type: 'concrete' },
    { x: 2450, y: 2450, width: 180, height: 15, type: 'concrete' },
    { x: 2680, y: 2450, width: 210, height: 15, type: 'concrete' },
    { x: 2450, y: 2875, width: 440, height: 15, type: 'concrete' },
    // Sandbags
    { x: 2510, y: 2510, width: 70, height: 60, type: 'sandbag' },
    { x: 2700, y: 2520, width: 50, height: 50, type: 'sandbag' },
    { x: 2560, y: 2720, width: 90, height: 40, type: 'sandbag' },
    { x: 2780, y: 2700, width: 60, height: 70, type: 'sandbag' },

    // === LONG CORRIDORS ===

    // Top horizontal corridor
    { x: 550, y: 150, width: 900, height: 15, type: 'concrete' },
    { x: 1450, y: 150, width: 550, height: 15, type: 'concrete' },
    // Pillars in corridor
    { x: 750, y: 200, width: 25, height: 120, type: 'pillar' },
    { x: 1000, y: 200, width: 25, height: 80, type: 'pillar' },
    { x: 1200, y: 200, width: 25, height: 100, type: 'pillar' },
    { x: 1650, y: 200, width: 25, height: 90, type: 'pillar' },
    { x: 1900, y: 200, width: 25, height: 110, type: 'pillar' },

    // Bottom horizontal corridor
    { x: 550, y: 2875, width: 900, height: 15, type: 'concrete' },
    { x: 1450, y: 2875, width: 550, height: 15, type: 'concrete' },
    // Pillars
    { x: 750, y: 2700, width: 25, height: 120, type: 'pillar' },
    { x: 1000, y: 2750, width: 25, height: 90, type: 'pillar' },
    { x: 1200, y: 2720, width: 25, height: 110, type: 'pillar' },
    { x: 1650, y: 2730, width: 25, height: 100, type: 'pillar' },
    { x: 1900, y: 2700, width: 25, height: 120, type: 'pillar' },

    // Left vertical corridor
    { x: 150, y: 550, width: 400, height: 15, type: 'concrete' },
    { x: 150, y: 1450, width: 200, height: 15, type: 'concrete' },
    { x: 150, y: 2000, width: 400, height: 15, type: 'concrete' },
    // Pillars
    { x: 200, y: 750, width: 110, height: 25, type: 'pillar' },
    { x: 200, y: 1000, width: 80, height: 25, type: 'pillar' },
    { x: 200, y: 1200, width: 100, height: 25, type: 'pillar' },
    { x: 200, y: 1650, width: 90, height: 25, type: 'pillar' },
    { x: 200, y: 1900, width: 110, height: 25, type: 'pillar' },

    // Right vertical corridor
    { x: 2450, y: 550, width: 440, height: 15, type: 'concrete' },
    { x: 2650, y: 1450, width: 240, height: 15, type: 'concrete' },
    { x: 2450, y: 2000, width: 440, height: 15, type: 'concrete' },
    // Pillars
    { x: 2700, y: 750, width: 110, height: 25, type: 'pillar' },
    { x: 2720, y: 1000, width: 80, height: 25, type: 'pillar' },
    { x: 2700, y: 1200, width: 100, height: 25, type: 'pillar' },
    { x: 2700, y: 1650, width: 90, height: 25, type: 'pillar' },
    { x: 2710, y: 1900, width: 110, height: 25, type: 'pillar' },

    // === CENTER COMPOUND ===

    // Outer walls
    { x: 1150, y: 1150, width: 700, height: 15, type: 'concrete' },
    { x: 1150, y: 1835, width: 250, height: 15, type: 'concrete' },
    { x: 1550, y: 1835, width: 300, height: 15, type: 'concrete' },
    { x: 1150, y: 1150, width: 15, height: 250, type: 'concrete' },
    { x: 1150, y: 1550, width: 15, height: 300, type: 'concrete' },
    { x: 1835, y: 1150, width: 15, height: 250, type: 'concrete' },
    { x: 1835, y: 1550, width: 15, height: 300, type: 'concrete' },

    // Inner cross walls
    { x: 1150, y: 1490, width: 270, height: 15, type: 'concrete' },
    { x: 1560, y: 1490, width: 295, height: 15, type: 'concrete' },
    { x: 1490, y: 1150, width: 15, height: 270, type: 'concrete' },
    { x: 1490, y: 1560, width: 15, height: 295, type: 'concrete' },

    // Center piece
    { x: 1430, y: 1430, width: 140, height: 140, type: 'barrier' },

    // Sub-room crates
    { x: 1200, y: 1200, width: 50, height: 50, type: 'sandbag' },
    { x: 1310, y: 1250, width: 40, height: 60, type: 'crate' },
    { x: 1200, y: 1360, width: 60, height: 40, type: 'sandbag' },

    { x: 1580, y: 1200, width: 60, height: 50, type: 'crate' },
    { x: 1720, y: 1210, width: 50, height: 80, type: 'crate' },
    { x: 1650, y: 1360, width: 70, height: 40, type: 'sandbag' },

    { x: 1200, y: 1600, width: 50, height: 70, type: 'sandbag' },
    { x: 1310, y: 1700, width: 60, height: 50, type: 'crate' },
    { x: 1200, y: 1760, width: 40, height: 40, type: 'sandbag' },

    { x: 1590, y: 1610, width: 60, height: 60, type: 'crate' },
    { x: 1710, y: 1590, width: 50, height: 40, type: 'crate' },
    { x: 1660, y: 1720, width: 70, height: 60, type: 'sandbag' },

    // === DIAGONAL SCATTER ZONES ===

    // NW quadrant
    { x: 700, y: 700, width: 80, height: 15, type: 'barrier' },
    { x: 700, y: 700, width: 15, height: 80, type: 'barrier' },
    { x: 860, y: 760, width: 80, height: 15, type: 'barrier' },
    { x: 940, y: 700, width: 15, height: 80, type: 'barrier' },
    { x: 760, y: 900, width: 15, height: 80, type: 'barrier' },
    { x: 760, y: 980, width: 80, height: 15, type: 'barrier' },
    { x: 920, y: 900, width: 80, height: 15, type: 'barrier' },
    { x: 920, y: 900, width: 15, height: 80, type: 'barrier' },
    { x: 650, y: 1050, width: 60, height: 60, type: 'crate' },
    { x: 850, y: 1050, width: 60, height: 60, type: 'crate' },
    { x: 1050, y: 850, width: 60, height: 60, type: 'crate' },
    { x: 1050, y: 650, width: 60, height: 60, type: 'crate' },

    // NE quadrant
    { x: 2100, y: 700, width: 80, height: 15, type: 'barrier' },
    { x: 2100, y: 700, width: 15, height: 80, type: 'barrier' },
    { x: 2250, y: 760, width: 80, height: 15, type: 'barrier' },
    { x: 2330, y: 700, width: 15, height: 80, type: 'barrier' },
    { x: 2160, y: 900, width: 15, height: 80, type: 'barrier' },
    { x: 2160, y: 980, width: 80, height: 15, type: 'barrier' },
    { x: 2310, y: 900, width: 80, height: 15, type: 'barrier' },
    { x: 2310, y: 900, width: 15, height: 80, type: 'barrier' },
    { x: 2050, y: 1050, width: 60, height: 60, type: 'sandbag' },
    { x: 2230, y: 1050, width: 60, height: 60, type: 'sandbag' },
    { x: 2380, y: 850, width: 60, height: 60, type: 'crate' },
    { x: 2380, y: 650, width: 60, height: 60, type: 'crate' },

    // SW quadrant
    { x: 700, y: 2100, width: 80, height: 15, type: 'barrier' },
    { x: 700, y: 2100, width: 15, height: 80, type: 'barrier' },
    { x: 860, y: 2170, width: 80, height: 15, type: 'barrier' },
    { x: 940, y: 2100, width: 15, height: 80, type: 'barrier' },
    { x: 760, y: 2300, width: 15, height: 80, type: 'barrier' },
    { x: 760, y: 2380, width: 80, height: 15, type: 'barrier' },
    { x: 920, y: 2300, width: 80, height: 15, type: 'barrier' },
    { x: 920, y: 2300, width: 15, height: 80, type: 'barrier' },
    { x: 650, y: 2100, width: 60, height: 60, type: 'sandbag' },
    { x: 850, y: 2380, width: 60, height: 60, type: 'sandbag' },
    { x: 1050, y: 2300, width: 60, height: 60, type: 'crate' },
    { x: 1050, y: 2100, width: 60, height: 60, type: 'crate' },

    // SE quadrant
    { x: 2100, y: 2100, width: 80, height: 15, type: 'barrier' },
    { x: 2100, y: 2100, width: 15, height: 80, type: 'barrier' },
    { x: 2250, y: 2170, width: 80, height: 15, type: 'barrier' },
    { x: 2330, y: 2100, width: 15, height: 80, type: 'barrier' },
    { x: 2160, y: 2300, width: 15, height: 80, type: 'barrier' },
    { x: 2160, y: 2380, width: 80, height: 15, type: 'barrier' },
    { x: 2310, y: 2300, width: 80, height: 15, type: 'barrier' },
    { x: 2310, y: 2300, width: 15, height: 80, type: 'barrier' },
    { x: 2050, y: 2100, width: 60, height: 60, type: 'sandbag' },
    { x: 2230, y: 2380, width: 60, height: 60, type: 'sandbag' },
    { x: 2380, y: 2300, width: 60, height: 60, type: 'crate' },
    { x: 2380, y: 2100, width: 60, height: 60, type: 'crate' },

    // === MID CORRIDORS ===

    // North corridor into center
    { x: 1350, y: 700, width: 15, height: 450, type: 'concrete' },
    { x: 1635, y: 700, width: 15, height: 450, type: 'concrete' },
    { x: 1380, y: 800, width: 70, height: 50, type: 'barrier' },
    { x: 1530, y: 900, width: 70, height: 50, type: 'barrier' },
    { x: 1380, y: 1000, width: 70, height: 50, type: 'barrier' },

    // South corridor into center
    { x: 1350, y: 1850, width: 15, height: 450, type: 'concrete' },
    { x: 1635, y: 1850, width: 15, height: 450, type: 'concrete' },
    { x: 1380, y: 1950, width: 70, height: 50, type: 'barrier' },
    { x: 1530, y: 2050, width: 70, height: 50, type: 'barrier' },
    { x: 1380, y: 2150, width: 70, height: 50, type: 'barrier' },

    // West corridor into center
    { x: 700, y: 1350, width: 450, height: 15, type: 'concrete' },
    { x: 700, y: 1635, width: 450, height: 15, type: 'concrete' },
    { x: 800, y: 1380, width: 50, height: 70, type: 'barrier' },
    { x: 900, y: 1530, width: 50, height: 70, type: 'barrier' },
    { x: 1000, y: 1380, width: 50, height: 70, type: 'barrier' },

    // East corridor into center
    { x: 1850, y: 1350, width: 450, height: 15, type: 'concrete' },
    { x: 1850, y: 1635, width: 450, height: 15, type: 'concrete' },
    { x: 1950, y: 1380, width: 50, height: 70, type: 'barrier' },
    { x: 2050, y: 1530, width: 50, height: 70, type: 'barrier' },
    { x: 2150, y: 1380, width: 50, height: 70, type: 'barrier' },

    // === RANDOM SCATTER ===
    { x: 600, y: 1300, width: 45, height: 45, type: 'crate' },
    { x: 620, y: 1480, width: 45, height: 45, type: 'crate' },
    { x: 2300, y: 1300, width: 45, height: 45, type: 'crate' },
    { x: 2280, y: 1500, width: 45, height: 45, type: 'crate' },
    { x: 1280, y: 600, width: 45, height: 45, type: 'crate' },
    { x: 1500, y: 620, width: 45, height: 45, type: 'crate' },
    { x: 1280, y: 2300, width: 45, height: 45, type: 'crate' },
    { x: 1500, y: 2340, width: 45, height: 45, type: 'crate' },

    // L-shapes mid areas
    { x: 1050, y: 1250, width: 80, height: 15, type: 'concrete' },
    { x: 1050, y: 1250, width: 15, height: 80, type: 'concrete' },
    { x: 1840, y: 1250, width: 80, height: 15, type: 'concrete' },
    { x: 1905, y: 1250, width: 15, height: 80, type: 'concrete' },
    { x: 1050, y: 1720, width: 80, height: 15, type: 'concrete' },
    { x: 1050, y: 1640, width: 15, height: 80, type: 'concrete' },
    { x: 1840, y: 1720, width: 80, height: 15, type: 'concrete' },
    { x: 1905, y: 1640, width: 15, height: 80, type: 'concrete' },
];
