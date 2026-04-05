import './style.css'

import { createPlayer, generatePlayers } from './Player/player'
import { setActivePlayer } from './Globals/Players';
import { drawFogOfWar } from './Player/Raycast/fogOfWar';
import { drawCollisionOverlay } from './Environment/generateCollisionMap';
import { environment, generateEnvironment } from './Environment/environment';
import { createWall } from './Environment/Wall/wall';
import { MAP_OFFSET } from './constants';
import { initMatch, setOnKillCallback } from './Combat/gameState';
import { initHUD, addKillFeedEntry } from './HUD/hud';
import { getActiveMap } from './Maps/helpers';
import { registerAI } from './AI/ai';

export const app = document.getElementById('app') as HTMLElement;
export { MAP_OFFSET };
export const SETTINGS: GameSettings = {
  debug: false,
  gameMode: 'tdm',
  raycast: {
    type: 'MAIN_THREAD'
  }
};

// --- Players ---
const ACTIVE_MAP = getActiveMap();
const PLAYERS = generatePlayers(8, 2, ACTIVE_MAP.teamSpawns);

document.addEventListener('DOMContentLoaded', () => {
  generateEnvironment();
  drawFogOfWar();

  for (const wall of ACTIVE_MAP.walls) {
    createWall(wall);
  }

  if (SETTINGS.debug) {
    drawCollisionOverlay(environment);
  }

  for (const player of PLAYERS) {
    if (player.id === 1) {
      setActivePlayer(player.id);
    }  

    createPlayer(player, player.id === 1);
    if (player.id !== 1) {
      registerAI(player);
    }
  }

  initMatch(PLAYERS.map(p => p.id));
  initHUD();
  setOnKillCallback(addKillFeedEntry);

  document.body.style.cursor = 'none';
})
