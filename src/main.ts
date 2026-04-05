import './style.css'

import { createPlayer, generatePlayers } from './Player/player'
import { setActivePlayer } from './Globals/Players';
import { drawFogOfWar } from './Player/Raycast/fogOfWar';
import { drawCollisionOverlay } from './Environment/generateCollisionMap';
import { environment, generateEnvironment } from './Environment/environment';
import { createWall } from './Environment/Wall/wall';
import { MAP_OFFSET } from './constants';
import { initMatch, setOnKillCallback, setOnRoundEndCallback } from './Combat/gameState';
import { initHUD, addKillFeedEntry, showRoundEndBanner } from './HUD/hud';
import { getActiveMap } from './Maps/helpers';
import { registerAI } from './AI/ai';
import { resumeAudioContext } from './Audio/audio';
import { loadAllSounds } from './Audio/soundMap';
import { initProjectilePool } from './Combat/ProjectilePool';
import { clientRenderer } from './Net/ClientRenderer';

export const app = document.getElementById('app') as HTMLElement;
export { MAP_OFFSET };
export const SETTINGS: GameSettings = {
  debug: false,
  gameMode: 'tdm',
  raycast: {
    type: 'MAIN_THREAD'
  },
  audio: {
    masterVolume: 0.4,
    sfxVolume: 0.6,
    muted: false,
  }
};

// --- Players ---
const ACTIVE_MAP = getActiveMap();
const PLAYERS = generatePlayers(20, 2, ACTIVE_MAP.teamSpawns);

document.addEventListener('DOMContentLoaded', () => {
  generateEnvironment();
  drawFogOfWar();
  initProjectilePool();
  clientRenderer.init();

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
  setOnRoundEndCallback(showRoundEndBanner);

  // Audio setup
  loadAllSounds();
  const unlockAudio = () => {
    resumeAudioContext();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  document.body.style.cursor = 'none';
})
