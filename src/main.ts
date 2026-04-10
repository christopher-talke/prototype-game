import './style.css';

import { drawFogOfWar } from '@rendering/fogOfWar';
import { generateEnvironment } from '@simulation/environment/environment';
import { initHUD } from '@rendering/hud';
import { resumeAudioContext, playMenuMusic } from '@audio/index';
import { loadAllSounds } from '@audio/soundMap';
import { initProjectilePool } from '@simulation/combat/projectilePool';
import { clientRenderer } from '@rendering/clientRenderer';
import { showMainMenu } from '@ui/mainMenu/mainMenu';
import { showLoadingScreen, setLoadingProgress, hideLoadingScreen } from '@ui/loading/loadingScreen';
import { initGameLoop } from '@simulation/gameLoop';
import { initMatchSystem, launchMatch } from '@simulation/match/match';
import { SETTINGS } from './app';
import { initPixiApp, hidePixiCanvas } from '@rendering/pixi/pixiApp';
import { initPixiProjectilePool } from '@rendering/pixi/pixiProjectilePool';
import { pixiClientRenderer } from '@rendering/pixi/pixiClientRenderer';
import { initPixiFogOfWar } from '@rendering/pixi/pixiFogOfWar';
import { initPixiAimLine } from '@rendering/pixi/pixiAimLineRenderer';

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
    pixiClientRenderer.init();

    setLoadingProgress(30, 'initializing renderer');
    await initPixiApp();
    initPixiProjectilePool();
    initPixiFogOfWar();
    initPixiAimLine();
    if (SETTINGS.renderer === 'dom') {
        hidePixiCanvas();
    } else {
        document.body.classList.add('renderer-pixi');
    }
    await nextFrame();

    setLoadingProgress(45, 'initializing input');
    initGameLoop();
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
