import './style.css'

import { createPlayer } from './Player/player'
import { getRandomNumber } from './Utilities/getRandomNumber'
import { setActivePlayer } from './Globals/Players';
import { drawFogOfWar } from './Player/Raycast/fogOfWar';
import { drawCollisionOverlay } from './Environment/generateCollisionMap';
import { environment, generateEnvironment } from './Environment/environment';
import { createWall } from './Environment/Wall/wall';
import { MAP_OFFSET } from './constants';

export const app = document.getElementById('app') as HTMLElement;
export { MAP_OFFSET };
export const SETTINGS: GameSettings = {
  debug: false,
  raycast: {
    type: 'MAIN_THREAD'
  }
};

// --- Players ---

const PLAYER_1 = {
  id: getRandomNumber(1001, 9999),
  team: 1,
  name: 'Ekky',
  health: 100,
  armour: 100,
  current_position: {
    x: 1400,
    y: 2550,
    rotation: 0,
  },
  weapons: [{ id: 1, active: true, ammo: 12, firing_rate: 500, type: 'PISTOL' }]
}

const PLAYER_2 = {
  id: getRandomNumber(1001, 9999),
  team: 1,
  name: 'Tonkymac',
  health: 100,
  armour: 100,
  current_position: {
    x: 1500,
    y: 2550,
    rotation: 0,
  },
  weapons: [{ id: 1, active: true, ammo: 12, firing_rate: 500, type: 'PISTOL' }]
}

const PLAYER_3 = {
  id: getRandomNumber(1001, 9999),
  team: 2,
  name: 'Frank',
  health: 100,
  armour: 100,
  current_position: {
    x: 1450,
    y: 350,
    rotation: 180,
  },
  weapons: [{ id: 1, active: true, ammo: 12, firing_rate: 500, type: 'PISTOL' }]
}

// --- Map: Dust-inspired layout ---
// 3000x3000 play area
// T Spawn: bottom center (~y:2400-2700)
// CT Spawn: top center (~y:250-500)
// A Site: top-right quadrant
// B Site: top-left quadrant
// Mid: central corridor
// Long A: right-side corridor
// B Tunnels: lower-left passage

const WALLS: wall_info[] = [
  // =============================================
  // OUTER BOUNDARY WALLS (play area ~300-2700)
  // =============================================
  // Top
  { x: 300, y: 300, width: 2400, height: 15 },
  // Bottom
  { x: 300, y: 2700, width: 2400, height: 15 },
  // Left
  { x: 300, y: 300, width: 15, height: 2400 },
  // Right
  { x: 2685, y: 300, width: 15, height: 2400 },

  // =============================================
  // T SPAWN AREA (bottom center)
  // =============================================
  // Left wall of T spawn corridor
  { x: 1100, y: 2300, width: 15, height: 400 },
  // Right wall of T spawn corridor
  { x: 1850, y: 2300, width: 15, height: 400 },

  // =============================================
  // MID CORRIDOR (center of map)
  // =============================================
  // Left wall of mid
  { x: 1100, y: 1200, width: 15, height: 700 },
  // Right wall of mid
  { x: 1850, y: 1200, width: 15, height: 700 },
  // Mid crossover box (cover in mid)
  { x: 1420, y: 1500, width: 120, height: 120 },

  // =============================================
  // T TO MID CONNECTOR (connects T spawn to mid)
  // =============================================
  // Left wall
  { x: 1100, y: 1900, width: 250, height: 15 },
  // Right wall
  { x: 1600, y: 1900, width: 265, height: 15 },
  // Lower mid doors left
  { x: 1100, y: 2100, width: 15, height: 200 },
  // Lower mid doors right
  { x: 1850, y: 2100, width: 15, height: 200 },
  // Mid entrance cover (crate)
  { x: 1350, y: 2050, width: 80, height: 60 },

  // =============================================
  // A SITE (top-right)
  // =============================================
  // A site back wall (north)
  { x: 1900, y: 500, width: 750, height: 15 },
  // A site left wall
  { x: 1900, y: 500, width: 15, height: 450 },
  // A site platform (elevated box)
  { x: 2300, y: 600, width: 150, height: 100 },
  // A site pillar
  { x: 2100, y: 750, width: 60, height: 60 },

  // =============================================
  // LONG A (right side corridor from T spawn to A)
  // =============================================
  // Long A outer wall (right)
  { x: 2450, y: 950, width: 15, height: 1400 },
  // Long A inner wall (left)
  { x: 2100, y: 950, width: 15, height: 900 },
  // Long A corner box (pit area cover)
  { x: 2200, y: 1600, width: 100, height: 80 },
  // Long A doors - left piece
  { x: 2100, y: 1850, width: 120, height: 15 },
  // Long A doors - right piece
  { x: 2330, y: 1850, width: 135, height: 15 },
  // Long A lower wall extending to T area
  { x: 2100, y: 1850, width: 15, height: 500 },
  // Long A to T connector right
  { x: 2450, y: 2350, width: 15, height: 350 },
  // Long A bottom wall
  { x: 1865, y: 2350, width: 600, height: 15 },

  // =============================================
  // CT to A connector (short A / catwalk)
  // =============================================
  // Catwalk left wall
  { x: 1900, y: 950, width: 200, height: 15 },
  // Catwalk right wall
  { x: 2100, y: 680, width: 15, height: 285 },
  // CT elevator wall
  { x: 1700, y: 500, width: 200, height: 15 },

  // =============================================
  // B SITE (top-left)
  // =============================================
  // B site back wall (north)
  { x: 400, y: 500, width: 650, height: 15 },
  // B site right wall
  { x: 1050, y: 500, width: 15, height: 450 },
  // B site crate cluster
  { x: 550, y: 600, width: 120, height: 80 },
  { x: 700, y: 700, width: 80, height: 80 },
  // B site pillar
  { x: 900, y: 650, width: 50, height: 50 },

  // =============================================
  // B TUNNELS (lower-left passage from T to B)
  // =============================================
  // Tunnel outer wall (left)
  { x: 500, y: 950, width: 15, height: 1400 },
  // Tunnel inner wall (right)
  { x: 850, y: 1200, width: 15, height: 700 },
  // Tunnel entrance top
  { x: 500, y: 950, width: 365, height: 15 },
  // Tunnel to B connector
  { x: 500, y: 680, width: 15, height: 285 },
  // B doors left piece
  { x: 500, y: 1850, width: 130, height: 15 },
  // B doors right piece
  { x: 730, y: 1850, width: 135, height: 15 },
  // Lower tunnel walls
  { x: 500, y: 2350, width: 615, height: 15 },
  { x: 850, y: 1900, width: 15, height: 200 },
  // Tunnel cover (corner box)
  { x: 600, y: 1500, width: 80, height: 100 },

  // =============================================
  // CT SPAWN AREA (top center)
  // =============================================
  // CT left corridor wall
  { x: 1050, y: 300, width: 15, height: 200 },
  // CT right corridor wall
  { x: 1700, y: 300, width: 15, height: 200 },

  // =============================================
  // MID TO B CONNECTOR (window room / short B)
  // =============================================
  { x: 850, y: 1200, width: 250, height: 15 },
  { x: 850, y: 950, width: 200, height: 15 },
  // Window opening cover
  { x: 950, y: 1050, width: 60, height: 60 },

  // =============================================
  // MID TO A CONNECTOR
  // =============================================
  { x: 1865, y: 1200, width: 250, height: 15 },
  // Connector cover
  { x: 1950, y: 1050, width: 60, height: 60 },
];

document.addEventListener('DOMContentLoaded', () => {
  generateEnvironment();
  drawFogOfWar();

  for (const wall of WALLS) {
    createWall(wall);
  }

  if (SETTINGS.debug) {
    drawCollisionOverlay(environment);
  }

  setActivePlayer(PLAYER_1.id);
  createPlayer(PLAYER_1, true);
  createPlayer(PLAYER_2, false);
  createPlayer(PLAYER_3, false);
})
