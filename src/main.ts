import './style.css';

import { drawFogOfWar } from '@rendering/fogOfWar';
import { generateEnvironment } from '@simulation/environment/environment';
import { registerWallGeometry } from '@simulation/environment/wallData';
import { renderWall } from '@rendering/wallRenderer';
import { initHUD } from '@rendering/hud';
import { getActiveMap } from '@maps/helpers';
import { resumeAudioContext, playMenuMusic } from '@audio/audio';
import { loadAllSounds } from '@audio/soundMap';
import { initProjectilePool } from '@simulation/combat/projectilePool';
import { clientRenderer } from '@rendering/clientRenderer';
import { showMainMenu } from '@ui/mainMenu/mainMenu';
import { showLoadingScreen, setLoadingProgress, hideLoadingScreen } from '@ui/loading/loadingScreen';
import { initGameLoop } from '@simulation/gameLoop';
import { initMatchSystem, launchMatch } from '@simulation/match/match';
import { getConfig, setGameMode } from '@config/activeConfig';

import { getGPUTier } from '@pmndrs/detect-gpu';

const ACTIVE_MAP = getActiveMap();

function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

document.addEventListener('DOMContentLoaded', async () => {

    const gpuTier = await getGPUTier();
    const knownVendors = ['nvidia', 'amd'];
    const gpuName = gpuTier.gpu?.toLowerCase() || '';
    if (!knownVendors.some(vendor => gpuName.includes(vendor))) {
        setGameMode({
            match: {
                maxPlayers: 10,
            },
            gameplay: {
                disableLowHealthEffects: true
            }
        })
        console.log(getConfig());
        alert(`No dedicated GPU detected. The game configurations and effects have been reduced/disabled to improve performance. You may still experience lag or stuttering. If you encounter significant issues, please try closing other applications or upgrading your hardware. We apologize for the inconvenience.`);
    }

    if (gpuTier.isMobile) {
        alert('Mobile devices are not supported at this time. You will be redirected to a video showcasing the game instead! Sorry for the inconvenience.');
        window.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        return;
    }

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
        registerWallGeometry(wall);
        renderWall(wall);
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
