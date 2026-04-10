import { SETTINGS, saveRendererSetting } from '../app';
import { showPixiCanvas, hidePixiCanvas } from './pixi/pixiApp';
import { clearPixiWalls, renderPixiWalls } from './pixi/pixiWallRenderer';
import { setWorldBounds } from './pixi/pixiSceneGraph';
import { clearPixiSmokeClouds } from './pixi/pixiSmokeRenderer';
import { pixiClientRenderer } from './pixi/pixiClientRenderer';
import { hidePixiFog } from './pixi/pixiFogOfWar';
import { clientRenderer } from './clientRenderer';
import { clearRenderedWalls, renderWall } from './wallRenderer';
import { createPlayer } from './playerRenderer';
import { getAllPlayers, ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { getActiveMap } from '@maps/helpers';
import { environment } from '@simulation/environment/environment';

export function switchRenderer(newType: RendererType) {
    if (SETTINGS.renderer === newType) return;

    // Tear down both renderers to clear any stale state
    pixiClientRenderer.teardownVisuals();
    clearPixiWalls();
    clearPixiSmokeClouds();
    hidePixiFog();

    clientRenderer.teardownVisuals();
    clearRenderedWalls();

    // Switch the setting
    SETTINGS.renderer = newType;
    saveRendererSetting(newType);

    // Toggle canvas / DOM visibility
    if (newType === 'pixi') {
        showPixiCanvas();
        document.body.classList.add('renderer-pixi');
    } else {
        hidePixiCanvas();
        document.body.classList.remove('renderer-pixi');
    }

    // Rebuild walls from current map
    const map = getActiveMap();
    if (newType === 'pixi') {
        setWorldBounds(environment.limits.right, environment.limits.bottom);
        renderPixiWalls(map.walls);
    } else {
        for (const wall of map.walls) renderWall(wall);
    }

    // Rebuild player visuals from current registry
    const localPlayer = ACTIVE_PLAYER != null ? getPlayerInfo(ACTIVE_PLAYER) : null;
    const localTeam = localPlayer?.team;
    for (const player of getAllPlayers()) {
        createPlayer(player, player.id === ACTIVE_PLAYER, localTeam);
    }
}
