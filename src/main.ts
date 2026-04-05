import './style.css'

import { createPlayer } from './Player/player'
import { getRandomNumber } from './Utilities/getRandomNumber'
import { setActivePlayer } from './Globals/Players';
import { drawFogOfWar } from './Player/Raycast/fogOfWar';
import { drawCollisionOverlay } from './Environment/generateCollisionMap';
import { environment, generateEnvironment } from './Environment/environment';
import { createWall } from './Environment/Wall/wall';
import { MAP_OFFSET } from './constants';
import { initMatch, setOnKillCallback } from './Combat/gameState';
import { initHUD, addKillFeedEntry } from './HUD/hud';
import { Arena } from './Maps/arena';
import { registerAI } from './AI/ai';

export const app = document.getElementById('app') as HTMLElement;
export { MAP_OFFSET };
export const SETTINGS: GameSettings = {
  debug: false,
  raycast: {
    type: 'MAIN_THREAD'
  }
};

// --- Players ---

const PLAYER_1: player_info = {
  id: getRandomNumber(1001, 9999),
  team: 1,
  name: 'Ekky',
  health: 100,
  armour: 100,
  dead: false,
  current_position: {
    x: 350,
    y: 350,
    rotation: 0,
  },
  weapons: [{ id: 1, active: true, ammo: 12, maxAmmo: 12, firing_rate: 500, reloading: false, type: 'PISTOL' }]
}

const PLAYER_2: player_info = {
  id: getRandomNumber(1001, 9999),
  team: 1,
  name: 'Tonkymac',
  health: 100,
  armour: 100,
  dead: false,
  current_position: {
    x: 2450,
    y: 2450,
    rotation: 180,
  },
  weapons: [{ id: 1, active: true, ammo: 12, maxAmmo: 12, firing_rate: 500, reloading: false, type: 'PISTOL' }]
}

const PLAYER_3: player_info = {
  id: getRandomNumber(1001, 9999),
  team: 2,
  name: 'Frank',
  health: 100,
  armour: 100,
  dead: false,
  current_position: {
    x: 2450,
    y: 350,
    rotation: 180,
  },
  weapons: [{ id: 1, active: true, ammo: 12, maxAmmo: 12, firing_rate: 500, reloading: false, type: 'PISTOL' }]
}

const WALLS = Arena;

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

  // Register AI for non-player characters
  registerAI(PLAYER_2);
  registerAI(PLAYER_3);

  // Init combat systems
  initMatch([PLAYER_1.id, PLAYER_2.id, PLAYER_3.id]);
  initHUD();
  setOnKillCallback(addKillFeedEntry);

  // Hide default cursor (crosshair replaces it)
  document.body.style.cursor = 'none';
})
