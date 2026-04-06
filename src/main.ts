import './style.css';

import { SETTINGS } from './Globals/App';
import { drawFogOfWar } from './Player/Raycast/fogOfWar';
import { drawCollisionOverlay } from './Environment/generateCollisionMap';
import { environment, generateEnvironment } from './Environment/environment';
import { createWall } from './Environment/Wall/wall';
import { initHUD } from './HUD/hud';
import { getActiveMap } from './Maps/helpers';
import { resumeAudioContext, playMenuMusic } from './Audio/audio';
import { loadAllSounds } from './Audio/soundMap';
import { initProjectilePool } from './Combat/ProjectilePool';
import { clientRenderer } from './Net/ClientRenderer';
import { showMainMenu } from './MainMenu/MainMenu';
import { showLoadingScreen, setLoadingProgress, hideLoadingScreen } from './Loading/LoadingScreen';
import { initInteractivity } from './Player/interactivity';
import { initMatchSystem, launchMatch } from './Match/match';

const ACTIVE_MAP = getActiveMap();

function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

document.addEventListener('DOMContentLoaded', async () => {
    showLoadingScreen();
    await nextFrame();

    setLoadingProgress(5, 'generating environment');
    generateEnvironment();
    await nextFrame();

    setLoadingProgress(15, 'drawing fog of war');
    drawFogOfWar();
    await nextFrame();

    setLoadingProgress(20, 'initializing systems');
    initProjectilePool();
    clientRenderer.init();

    setLoadingProgress(30, 'building walls');
    for (const wall of ACTIVE_MAP.walls) {
        createWall(wall);
    }
    await nextFrame();

    if (SETTINGS.debug) {
        drawCollisionOverlay(environment);
    }

    setLoadingProgress(45, 'initializing input');
    initInteractivity();
    await nextFrame();

    setLoadingProgress(60, 'initializing hud');
    initHUD();
    await nextFrame();

    setLoadingProgress(70, 'loading sounds');
    await loadAllSounds();

    setLoadingProgress(100, 'ready');
    await nextFrame();

    resumeAudioContext();
    playMenuMusic();

    initMatchSystem();

    await hideLoadingScreen();
    showMainMenu(launchMatch);
});
