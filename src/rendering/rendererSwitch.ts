import { SETTINGS, saveRendererSetting } from '../app';
import { showPixiCanvas, hidePixiCanvas } from './canvas/app';
import { clearPixiWalls, renderPixiWalls } from './canvas/wallRenderer';
import { setWorldBounds } from './canvas/sceneGraph';
import { clearSmokeEffects } from './canvas/effects/smokeEffect';
import { pixiClientRenderer } from './canvas/clientRenderer';
import { hidePixiFog } from './canvas/fogOfWar';
import { clientRenderer } from './dom/clientRenderer';
import { clearRenderedWalls, renderWall } from './dom/wallRenderer';
import { createPlayer } from './dom/playerRenderer';
import { getAllPlayers, ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { getActiveMap } from '@maps/helpers';
import { environment } from '@simulation/environment/environment';
import { initLighting, clearLighting } from '@rendering/canvas/lightingManager';
import { clearGridDisplacement } from '@rendering/canvas/gridDisplacement';
import { initGridTextures, clearGridTextures } from '@rendering/canvas/gridTextures';
import { initGloss, clearGloss } from '@rendering/canvas/effects/glossEffect';
import { getActiveMapId } from '@maps/helpers';
import { destroyPixiDiegeticHud } from '@rendering/diegeticHud/pixiDiegeticHud';
import { destroyDomDiegeticHud } from '@rendering/diegeticHud/domDiegeticHud';
import { resetDiegeticHud } from '@rendering/diegeticHud/diegeticHudState';

/**
 * Tears down both renderers and rebuilds the target renderer from current game state.
 * Handles canvas/DOM visibility toggling, wall rebuilding, lighting/grid re-init,
 * and player visual recreation.
 * @param newType - The renderer to switch to ('dom' or 'pixi').
 */
export function switchRenderer(newType: RendererType) {
    if (SETTINGS.renderer === newType) return;

    destroyPixiDiegeticHud();
    resetDiegeticHud();
    pixiClientRenderer.teardownVisuals();
    clearPixiWalls();
    clearSmokeEffects();
    hidePixiFog();
    clearLighting();
    clearGridDisplacement();
    clearGridTextures();
    clearGloss();

    clientRenderer.teardownVisuals();
    clearRenderedWalls();
    destroyDomDiegeticHud();

    SETTINGS.renderer = newType;
    saveRendererSetting(newType);

    if (newType === 'pixi') {
        showPixiCanvas();
        document.body.classList.add('renderer-pixi');
    }

    else {
        hidePixiCanvas();
        document.body.classList.remove('renderer-pixi');
    }

    const map = getActiveMap();
    if (newType === 'pixi') {
        setWorldBounds(environment.limits.right, environment.limits.bottom);
        renderPixiWalls(map.walls);
        initLighting(map.lights ?? [], map.walls, map.lighting);
        initGridTextures(getActiveMapId(), map.textureLayers);
        initGloss(map.gloss);
    }

    else {
        for (const wall of map.walls) renderWall(wall);
    }

    const localPlayer = ACTIVE_PLAYER != null ? getPlayerInfo(ACTIVE_PLAYER) : null;
    const localTeam = localPlayer?.team;
    for (const player of getAllPlayers()) {
        createPlayer(player, player.id === ACTIVE_PLAYER, localTeam);
    }
}
