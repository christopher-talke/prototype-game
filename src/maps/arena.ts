// Arena - AI-friendly map with wide corridors and open sightlines
// 3000x3000 play area
// Center plaza connects to 4 corner rooms via wide corridors
// Cover objects in open areas, no tight pinch points

export const Arena: MapData = {
    lighting: { ambientLight: 0.15, ambientColor: 0x101018 },
    lights: [
        // Corner room lights (warm)
        { x: 440, y: 440, radius: 400, color: 0xffddaa, intensity: 0.8 },
        { x: 2360, y: 440, radius: 400, color: 0xffddaa, intensity: 0.8 },
        { x: 440, y: 2360, radius: 400, color: 0xffddaa, intensity: 0.8 },
        { x: 2360, y: 2360, radius: 400, color: 0xffddaa, intensity: 0.8 },

        // Center plaza lights (cool white)
        { x: 1300, y: 1300, radius: 350, color: 0xeeeeff, intensity: 0.9 },
        { x: 1700, y: 1300, radius: 350, color: 0xeeeeff, intensity: 0.9 },
        { x: 1300, y: 1700, radius: 350, color: 0xeeeeff, intensity: 0.9 },
        { x: 1700, y: 1700, radius: 350, color: 0xeeeeff, intensity: 0.9 },

        // Corridor lights (cool blue)
        { x: 1200, y: 300, radius: 300, color: 0xc8dcff, intensity: 0.6 },
        { x: 1700, y: 300, radius: 300, color: 0xc8dcff, intensity: 0.6 },
        { x: 1200, y: 2700, radius: 300, color: 0xc8dcff, intensity: 0.6 },
        { x: 1700, y: 2700, radius: 300, color: 0xc8dcff, intensity: 0.6 },
        { x: 300, y: 1200, radius: 300, color: 0xc8dcff, intensity: 0.6 },
        { x: 300, y: 1700, radius: 300, color: 0xc8dcff, intensity: 0.6 },
        { x: 2700, y: 1200, radius: 300, color: 0xc8dcff, intensity: 0.6 },
        { x: 2700, y: 1700, radius: 300, color: 0xc8dcff, intensity: 0.6 },

        // Mid connector lights
        { x: 1500, y: 900, radius: 250, color: 0xddeeff, intensity: 0.5 },
        { x: 1500, y: 2100, radius: 250, color: 0xddeeff, intensity: 0.5 },
        { x: 900, y: 1500, radius: 250, color: 0xddeeff, intensity: 0.5 },
        { x: 2100, y: 1500, radius: 250, color: 0xddeeff, intensity: 0.5 },
    ],
    patrolPoints: [
        // Patrol points in corridors
        { x: 1100, y: 300 }, // top corridor
        { x: 1100, y: 700 },
        { x: 1100, y: 1200 },
        { x: 1100, y: 1600 },
        { x: 1100, y: 2000 },

        { x: 1900, y: 300 }, // top corridor
        { x: 1900, y: 700 },
        { x: 1900, y: 1200 },
        { x: 1900, y: 1600 },
        { x: 1900, y: 2000 },

        { x: 300, y: 1100 }, // left corridor
        { x: 700, y: 1100 },
        { x: 1200, y: 1100 },
        { x: 1600, y: 1100 },
        { x: 2000, y: 1100 },

        { x: 300, y: 1900 }, // right corridor
        { x: 700, y: 1900 },
        { x: 1200, y: 1900 },
        { x: 1600, y: 1900 },
        { x: 2000, y: 1900 },

        // Patrol points in center plaza
        { x: 1300, y: 1300 },
        { x: 1700, y: 1300 },
        { x: 1300, y: 1700 },
        { x: 1700, y: 1700 },
    ],
    teamSpawns: {
        1: [
            { x: 440, y: 440 }, // top-left room
            { x: 440, y: 2360 }, // bottom-left room
        ],
        2: [
            { x: 2360, y: 440 }, // top-right room
            { x: 2360, y: 2360 }, // bottom-right room
        ],
    },
    walls: [
        // === BOUNDARY ===
        { x: 200, y: 200, width: 2600, height: 15, type: 'concrete' },
        { x: 200, y: 2785, width: 2600, height: 15, type: 'concrete' },
        { x: 200, y: 200, width: 15, height: 2600, type: 'concrete' },
        { x: 2785, y: 200, width: 15, height: 2600, type: 'concrete' },

        // === TOP-LEFT ROOM ===
        { x: 215, y: 215, width: 550, height: 15, type: 'concrete' },
        { x: 215, y: 215, width: 15, height: 550, type: 'concrete' },
        { x: 215, y: 750, width: 200, height: 15, type: 'concrete' },
        { x: 615, y: 750, width: 150, height: 15, type: 'concrete' },
        { x: 750, y: 215, width: 15, height: 200, type: 'concrete' },
        { x: 750, y: 615, width: 15, height: 150, type: 'concrete' },
        // Cover
        { x: 330, y: 330, width: 80, height: 80, type: 'crate' },
        { x: 500, y: 330, width: 60, height: 60, type: 'crate' },
        { x: 330, y: 530, width: 60, height: 60, type: 'sandbag' },
        { x: 560, y: 560, width: 80, height: 80, type: 'crate' },

        // === TOP-RIGHT ROOM ===
        { x: 2035, y: 215, width: 550, height: 15, type: 'concrete' },
        { x: 2570, y: 215, width: 15, height: 550, type: 'concrete' },
        { x: 2035, y: 750, width: 150, height: 15, type: 'concrete' },
        { x: 2385, y: 750, width: 200, height: 15, type: 'concrete' },
        { x: 2035, y: 215, width: 15, height: 200, type: 'concrete' },
        { x: 2035, y: 615, width: 15, height: 150, type: 'concrete' },
        // Cover
        { x: 2160, y: 330, width: 80, height: 80, type: 'crate' },
        { x: 2380, y: 330, width: 60, height: 60, type: 'crate' },
        { x: 2160, y: 560, width: 80, height: 80, type: 'sandbag' },
        { x: 2430, y: 540, width: 60, height: 60, type: 'crate' },

        // === BOTTOM-LEFT ROOM ===
        { x: 215, y: 2035, width: 15, height: 550, type: 'concrete' },
        { x: 215, y: 2570, width: 550, height: 15, type: 'concrete' },
        { x: 215, y: 2035, width: 200, height: 15, type: 'concrete' },
        { x: 615, y: 2035, width: 150, height: 15, type: 'concrete' },
        { x: 750, y: 2035, width: 15, height: 150, type: 'concrete' },
        { x: 750, y: 2385, width: 15, height: 200, type: 'concrete' },
        // Cover
        { x: 330, y: 2140, width: 80, height: 80, type: 'sandbag' },
        { x: 560, y: 2140, width: 60, height: 60, type: 'crate' },
        { x: 330, y: 2390, width: 60, height: 60, type: 'crate' },
        { x: 530, y: 2390, width: 80, height: 80, type: 'crate' },

        // === BOTTOM-RIGHT ROOM ===
        { x: 2570, y: 2035, width: 15, height: 550, type: 'concrete' },
        { x: 2035, y: 2570, width: 550, height: 15, type: 'concrete' },
        { x: 2385, y: 2035, width: 200, height: 15, type: 'concrete' },
        { x: 2035, y: 2035, width: 150, height: 15, type: 'concrete' },
        { x: 2035, y: 2035, width: 15, height: 150, type: 'concrete' },
        { x: 2035, y: 2385, width: 15, height: 200, type: 'concrete' },
        // Cover
        { x: 2160, y: 2140, width: 80, height: 80, type: 'crate' },
        { x: 2400, y: 2140, width: 60, height: 60, type: 'sandbag' },
        { x: 2160, y: 2390, width: 60, height: 60, type: 'crate' },
        { x: 2400, y: 2380, width: 80, height: 80, type: 'crate' },

        // === TOP CORRIDOR (top-left to top-right) ===
        { x: 765, y: 215, width: 1270, height: 15, type: 'metal' },
        // Pillars along top corridor
        { x: 950, y: 260, width: 20, height: 120, type: 'pillar' },
        { x: 1200, y: 260, width: 20, height: 80, type: 'pillar' },
        { x: 1450, y: 260, width: 20, height: 120, type: 'pillar' },
        { x: 1700, y: 260, width: 20, height: 80, type: 'pillar' },
        { x: 1950, y: 260, width: 20, height: 120, type: 'pillar' },

        // === BOTTOM CORRIDOR (bottom-left to bottom-right) ===
        { x: 765, y: 2785, width: 1270, height: 15, type: 'metal' },
        // Pillars
        { x: 950, y: 2640, width: 20, height: 120, type: 'pillar' },
        { x: 1200, y: 2680, width: 20, height: 80, type: 'pillar' },
        { x: 1450, y: 2640, width: 20, height: 120, type: 'pillar' },
        { x: 1700, y: 2680, width: 20, height: 80, type: 'pillar' },
        { x: 1950, y: 2640, width: 20, height: 120, type: 'pillar' },

        // === LEFT CORRIDOR (top-left to bottom-left) ===
        { x: 215, y: 765, width: 15, height: 1270, type: 'metal' },
        // Pillars
        { x: 260, y: 950, width: 120, height: 20, type: 'pillar' },
        { x: 260, y: 1200, width: 80, height: 20, type: 'pillar' },
        { x: 260, y: 1450, width: 120, height: 20, type: 'pillar' },
        { x: 260, y: 1700, width: 80, height: 20, type: 'pillar' },
        { x: 260, y: 1950, width: 120, height: 20, type: 'pillar' },

        // === RIGHT CORRIDOR (top-right to bottom-right) ===
        { x: 2785, y: 765, width: 15, height: 1270, type: 'metal' },
        // Pillars
        { x: 2640, y: 950, width: 120, height: 20, type: 'pillar' },
        { x: 2680, y: 1200, width: 80, height: 20, type: 'pillar' },
        { x: 2640, y: 1450, width: 120, height: 20, type: 'pillar' },
        { x: 2680, y: 1700, width: 80, height: 20, type: 'pillar' },
        { x: 2640, y: 1950, width: 120, height: 20, type: 'pillar' },

        // === CENTER PLAZA ===
        // Open 800x800 area in the middle with cover objects

        // Center monument / main cover
        { x: 1380, y: 1380, width: 240, height: 240, type: 'barrier' },

        // 4 cover clusters around the monument
        { x: 1150, y: 1200, width: 70, height: 70, type: 'sandbag' },
        { x: 1150, y: 1330, width: 70, height: 70, type: 'sandbag' },

        { x: 1780, y: 1200, width: 70, height: 70, type: 'sandbag' },
        { x: 1780, y: 1330, width: 70, height: 70, type: 'sandbag' },

        { x: 1200, y: 1780, width: 70, height: 70, type: 'sandbag' },
        { x: 1330, y: 1780, width: 70, height: 70, type: 'sandbag' },

        { x: 1470, y: 1780, width: 70, height: 70, type: 'sandbag' },
        { x: 1600, y: 1780, width: 70, height: 70, type: 'sandbag' },

        // Crates at diagonal corners of plaza
        { x: 1100, y: 1100, width: 60, height: 60, type: 'crate' },
        { x: 1840, y: 1100, width: 60, height: 60, type: 'crate' },
        { x: 1100, y: 1840, width: 60, height: 60, type: 'crate' },
        { x: 1840, y: 1840, width: 60, height: 60, type: 'crate' },

        // === MID CONNECTORS (corridors from rooms to plaza) ===

        // Top connector walls (funneling from top corridor into center)
        { x: 1100, y: 750, width: 15, height: 250, type: 'concrete' },
        { x: 1885, y: 750, width: 15, height: 250, type: 'concrete' },
        // Cover in connector
        { x: 1200, y: 820, width: 60, height: 50, type: 'barrier' },
        { x: 1680, y: 820, width: 60, height: 50, type: 'barrier' },

        // Bottom connector walls
        { x: 1100, y: 2000, width: 15, height: 250, type: 'concrete' },
        { x: 1885, y: 2000, width: 15, height: 250, type: 'concrete' },
        // Cover
        { x: 1200, y: 2080, width: 60, height: 50, type: 'barrier' },
        { x: 1680, y: 2080, width: 60, height: 50, type: 'barrier' },

        // Left connector walls
        { x: 750, y: 1100, width: 250, height: 15, type: 'concrete' },
        { x: 750, y: 1885, width: 250, height: 15, type: 'concrete' },
        // Cover
        { x: 820, y: 1200, width: 50, height: 60, type: 'barrier' },
        { x: 820, y: 1680, width: 50, height: 60, type: 'barrier' },

        // Right connector walls
        { x: 2000, y: 1100, width: 250, height: 15, type: 'concrete' },
        { x: 2000, y: 1885, width: 250, height: 15, type: 'concrete' },
        // Cover
        { x: 2080, y: 1200, width: 50, height: 60, type: 'barrier' },
        { x: 2080, y: 1680, width: 50, height: 60, type: 'barrier' },
    ],
};
