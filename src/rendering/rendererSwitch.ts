import { SETTINGS, saveRendererSetting } from '../app';
import { showPixiCanvas, hidePixiCanvas } from './canvas/app';
import { clearPixiWalls, renderPixiWalls } from './canvas/wallRenderer';
import { setWorldBounds } from './canvas/sceneGraph';
import { clearPixiSmokeClouds } from './canvas/smokeRenderer';
import { pixiClientRenderer } from './canvas/clientRenderer';
import { hidePixiFog } from './canvas/fogOfWar';
import { clientRenderer } from './dom/clientRenderer';
import { clearRenderedWalls, renderWall } from './dom/wallRenderer';
import { createPlayer } from './dom/playerRenderer';
import { getAllPlayers, ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { getActiveMap } from '@maps/helpers';
import { environment } from '@simulation/environment/environment';
import { initLighting, clearLighting } from '@rendering/canvas/lightingManager';

export function switchRenderer(newType: RendererType) {
    if (SETTINGS.renderer === newType) return;

    // Tear down both renderers to clear any stale state
    pixiClientRenderer.teardownVisuals();
    clearPixiWalls();
    clearPixiSmokeClouds();
    hidePixiFog();
    clearLighting();

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
        initLighting(map.lights ?? [], map.lighting);
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
