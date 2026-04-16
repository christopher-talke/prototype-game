import { ROTATION_OFFSET } from '../constants';
import { SETTINGS } from '../app';

import { angleToRadians } from '@utils/angleToRadians';
import type { DetectionEntry } from '@simulation/detection/detection';
import { getPlayerElement } from '@rendering/playerElements';
import { applyVisibility, updateLastKnown, debugLineOfSight } from '@rendering/dom/visibilityRenderer';
import { generateRayCast, generateFOVCone, hideFOVCone, tickAdaptiveQuality, RaycastTypes } from '@rendering/dom/raycastRenderer';
import { updateSmokeClouds } from '@rendering/dom/smokeRenderer';
import { clientRenderer } from '@rendering/dom/clientRenderer';
import { updateAimLine, updateGrenadeAimLine } from '@rendering/dom/aimLineRenderer';
import { setCameraTarget, setCameraWeaponOffset, updateCamera } from '@rendering/dom/camera';
import { updateHUD } from '@rendering/dom/hud';
import type { NetAdapter } from '@net/netAdapter';
import { setPixiCameraTarget, setPixiCameraWeaponOffset, updatePixiCamera } from '@rendering/canvas/camera';
import { pixiClientRenderer } from '@rendering/canvas/clientRenderer';
import { applyPixiVisibility, updatePixiLastKnown } from '@rendering/canvas/playerRenderer';
import { updatePixiFogOfWar, hidePixiFog } from '@rendering/canvas/fogOfWar';
import { updatePixiAimLine, updatePixiGrenadeAimLine } from '@rendering/canvas/aimLineRenderer';
import { updateLighting } from '@rendering/canvas/lightingManager';
import { updateGridDisplacement } from '@rendering/canvas/gridDisplacement';
import { updateGridTextures } from '@rendering/canvas/gridTextures';
import { updateSmokeParticles } from '@rendering/canvas/effects/smokeEffect';
import { updateGloss } from '@rendering/canvas/effects/glossEffect';
import { getGraphicsConfig } from '@rendering/canvas/config/graphicsConfig';
import { getPixiCameraOffset, getZoomScale } from '@rendering/canvas/camera';
import { tickDiegeticHud, type DiegeticHudInput } from '@rendering/diegeticHud/diegeticHudState';
import { updatePixiDiegeticHud, initPixiDiegeticHud } from '@rendering/diegeticHud/pixiDiegeticHud';
import { initDomDiegeticHud, updateDomDiegeticHud } from '@rendering/diegeticHud/domDiegeticHud';
import { getDomCameraOffset } from '@rendering/dom/camera';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { PlayerStatus } from '@simulation/player/playerData';
import { HALF_HIT_BOX } from '../constants';

let _cachedFogEl: HTMLElement | null = null;

/**
 * Per-frame render orchestrator called by the game loop.
 * Delegates to either the PixiJS or DOM renderer based on the active setting,
 * updating visuals, camera, detection overlays, fog of war, lighting, and HUD.
 *
 * @param player - The local player's current state.
 * @param adapter - Network adapter providing projectiles, grenades, and match time.
 * @param timestamp - Current frame timestamp in milliseconds.
 * @param detections - Pre-computed detection results for all visible players.
 * @param cameraOffset - Forward offset applied to the camera for weapon recoil.
 * @param grenadeChargePercent - Current grenade throw charge in [0, 1].
 * @param selectedGrenadeType - The grenade type currently selected by the player.
 */
export function updateRenderPipeline(
    player: player_info,
    adapter: NetAdapter,
    timestamp: number,
    detections: { entries: readonly DetectionEntry[]; count: number },
    cameraOffset: number,
    grenadeChargePercent: number,
    selectedGrenadeType: GrenadeType,
) {
    const projectiles = adapter.getProjectiles();
    const grenades = adapter.getGrenades();

    if (SETTINGS.renderer === 'pixi') {
        pixiClientRenderer.updateVisuals(projectiles, grenades);
        if (getGraphicsConfig().features.gridDisplacement) updateGridDisplacement(player, projectiles);
        updateGridTextures();
        updateGloss(player.current_position.x, player.current_position.y);
        updateSmokeParticles(timestamp, projectiles);
    }

    else {
        clientRenderer.updateVisuals(projectiles, grenades);
    }

    if (SETTINGS.renderer !== 'pixi') updateSmokeClouds(timestamp);

    const facingRad = angleToRadians(player.current_position.rotation - ROTATION_OFFSET);
    const vpWidth = window.visualViewport!.width;
    const vpHeight = window.visualViewport!.height;

    if (SETTINGS.renderer === 'pixi') {
        setPixiCameraTarget(player.current_position.x, player.current_position.y);
        setPixiCameraWeaponOffset(cameraOffset, facingRad);
        updatePixiCamera(vpWidth, vpHeight);
    }

    else {
        setCameraTarget(player.current_position.x, player.current_position.y);
        setCameraWeaponOffset(cameraOffset, facingRad);
        updateCamera(vpWidth, vpHeight);
    }

    for (let i = 0; i < detections.count; i++) {
        const entry = detections.entries[i];
        if (SETTINGS.renderer === 'pixi') {
            applyPixiVisibility(entry.result, entry.targetId);
            updatePixiLastKnown(entry.result, entry.targetPlayer, entry.sourcePlayer);
        }

        else {
            const targetEl = getPlayerElement(entry.targetId);
            if (SETTINGS.debug) {
                debugLineOfSight(entry.blocked, entry.targetPlayer, entry.sourcePlayer, targetEl);
            }

            else {
                if (targetEl) applyVisibility(entry.result, targetEl);
                updateLastKnown(entry.result, entry.targetPlayer, entry.sourcePlayer);
            }
        }
    }

    if (SETTINGS.raycast.type === 'CORNERS') {
        const rayResult = generateRayCast(player, { type: RaycastTypes.CORNERS });
        if (SETTINGS.renderer === 'pixi' && rayResult) updatePixiFogOfWar(rayResult.vertices, rayResult.count);
        hideFOVCone();
        tickAdaptiveQuality(timestamp);
    }

    else if (SETTINGS.raycast.type === 'SPRAY') {
        const rayResult = generateRayCast(player, { type: RaycastTypes.SPRAY });
        if (SETTINGS.renderer === 'pixi' && rayResult) updatePixiFogOfWar(rayResult.vertices, rayResult.count);
        hideFOVCone();
    }

    else {
        generateFOVCone(player);
        if (!_cachedFogEl) _cachedFogEl = document.getElementById('fog-of-war');
        _cachedFogEl?.classList.add('d-none');
        if (SETTINGS.renderer === 'pixi') hidePixiFog();
    }

    if (SETTINGS.renderer === 'pixi' && getGraphicsConfig().features.dynamicLighting) {
        updateLighting(projectiles);
    }

    const shots = adapter.getConsecutiveShots(player.id);
    if (SETTINGS.renderer === 'pixi') {
        updatePixiAimLine(player, shots);
        updatePixiGrenadeAimLine(player, grenadeChargePercent, selectedGrenadeType);
    }

    else {
        updateAimLine(player, shots);
        updateGrenadeAimLine(player, grenadeChargePercent, selectedGrenadeType);
    }

    updateHUD(player, adapter.getMatchTimeRemaining(), selectedGrenadeType);

    // -- Diegetic HUD (in-world health arc + info boxes) --
    if (SETTINGS.renderer === 'pixi') {
        initPixiDiegeticHud();
        const weapon = getActiveWeapon(player);
        const cam = getPixiCameraOffset();
        const state = adapter.getPlayerState(player.id);

        const zoom = getZoomScale();
        const diegeticInput: DiegeticHudInput = {
            playerX: player.current_position.x + HALF_HIT_BOX,
            playerY: player.current_position.y + HALF_HIT_BOX,
            facingRad,
            health: player.health,
            armour: player.armour,
            ammo: weapon?.ammo ?? 0,
            maxAmmo: weapon?.maxAmmo ?? 0,
            isReloading: weapon?.reloading ?? false,
            weaponType: weapon?.type ?? '',
            money: state?.money ?? 0,
            grenades: player.grenades,
            selectedGrenadeType,
            viewportW: vpWidth / zoom,
            viewportH: vpHeight / zoom,
            cameraX: cam.x,
            cameraY: cam.y,
            timestamp,
            isDead: player.dead,
            isBuying: player.status === PlayerStatus.BUYING,
            isZoomed: zoom > 1.01,
        };

        const hudOutput = tickDiegeticHud(diegeticInput);
        updatePixiDiegeticHud(hudOutput);
    }

    else {
        initDomDiegeticHud();
        const weapon = getActiveWeapon(player);
        const cam = getDomCameraOffset();
        const state = adapter.getPlayerState(player.id);

        const diegeticInput: DiegeticHudInput = {
            playerX: player.current_position.x + HALF_HIT_BOX,
            playerY: player.current_position.y + HALF_HIT_BOX,
            facingRad,
            health: player.health,
            armour: player.armour,
            ammo: weapon?.ammo ?? 0,
            maxAmmo: weapon?.maxAmmo ?? 0,
            isReloading: weapon?.reloading ?? false,
            weaponType: weapon?.type ?? '',
            money: state?.money ?? 0,
            grenades: player.grenades,
            selectedGrenadeType,
            viewportW: vpWidth,
            viewportH: vpHeight,
            cameraX: cam.x,
            cameraY: cam.y,
            timestamp,
            isDead: player.dead,
            isBuying: player.status === PlayerStatus.BUYING,
            isZoomed: false,
        };

        const hudOutput = tickDiegeticHud(diegeticInput);
        updateDomDiegeticHud(hudOutput);
    }
}
