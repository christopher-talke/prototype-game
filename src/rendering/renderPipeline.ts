import { ROTATION_OFFSET } from '../constants';
import { SETTINGS } from '../app';

import { angleToRadians } from '@utils/angleToRadians';
import { detectOtherPlayers } from '@simulation/detection/detection';
import { getPlayerElement } from '@rendering/playerElements';
import { applyVisibility, updateLastKnown, debugLineOfSight } from '@rendering/dom/visibilityRenderer';
import { generateRayCast, generateFOVCone, hideFOVCone, tickAdaptiveQuality, RaycastTypes } from '@rendering/dom/raycastRenderer';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getWeaponDef } from '@simulation/combat/weapons';
import { updateSmokeClouds } from '@rendering/dom/smokeRenderer';
import { removeExpiredSmoke } from '@simulation/combat/smokeData';
import { clientRenderer } from '@rendering/dom/clientRenderer';
import { updateAimLine, updateGrenadeAimLine } from '@rendering/dom/aimLineRenderer';
import { setCameraTarget, setCameraWeaponOffset, updateCamera } from '@rendering/dom/camera';
import { updateHUD } from '@rendering/dom/hud';
import { offlineAdapter } from '@net/offlineAdapter';
import type { NetAdapter } from '@net/netAdapter';
import { setPixiCameraTarget, setPixiCameraWeaponOffset, updatePixiCamera } from '@rendering/canvas/camera';
import { pixiClientRenderer } from '@rendering/canvas/clientRenderer';
import { applyPixiVisibility, updatePixiLastKnown } from '@rendering/canvas/playerRenderer';
import { updatePixiFogOfWar, hidePixiFog, updatePixiFOVCone, hidePixiFOVCone } from '@rendering/canvas/fogOfWar';
import { updatePixiAimLine, updatePixiGrenadeAimLine } from '@rendering/canvas/aimLineRenderer';
import { updatePixiSmokeClouds } from '@rendering/canvas/smokeRenderer';
import { updateLighting } from '@rendering/canvas/lightingManager';

let _cachedFogEl: HTMLElement | null = null;

export function updateRenderPipeline(player: player_info, adapter: NetAdapter, timestamp: number) {

    if (SETTINGS.renderer === 'pixi') {
        pixiClientRenderer.updateVisuals();
    } else {
        clientRenderer.updateVisuals();
    }
    removeExpiredSmoke(timestamp);
    updateSmokeClouds(timestamp);
    if (SETTINGS.renderer === 'pixi') updatePixiSmokeClouds(timestamp);

    const weapon = getActiveWeapon(player);
    const weaponDef = weapon ? getWeaponDef(weapon.type) : null;
    const cameraOffsetDist = weaponDef ? weaponDef.cameraOffset : 0;
    const facingRad = angleToRadians(player.current_position.rotation - ROTATION_OFFSET);
    const vpWidth = window.visualViewport!.width;
    const vpHeight = window.visualViewport!.height;

    if (SETTINGS.renderer === 'pixi') {
        setPixiCameraTarget(player.current_position.x, player.current_position.y);
        setPixiCameraWeaponOffset(cameraOffsetDist, facingRad);
        updatePixiCamera(vpWidth, vpHeight);
    } else {
        setCameraTarget(player.current_position.x, player.current_position.y);
        setCameraWeaponOffset(cameraOffsetDist, facingRad);
        updateCamera(vpWidth, vpHeight);
    }

    const detections = detectOtherPlayers(player.id);
    for (const entry of detections) {
        if (SETTINGS.renderer === 'pixi') {
            applyPixiVisibility(entry.result, entry.targetId);
            updatePixiLastKnown(entry.result, entry.targetPlayer, entry.sourcePlayer);
        } else {
            const targetEl = getPlayerElement(entry.targetId);
            if (SETTINGS.debug) {
                debugLineOfSight(entry.blocked, entry.targetPlayer, entry.sourcePlayer, targetEl);
            } else {
                if (targetEl) applyVisibility(entry.result, targetEl);
                updateLastKnown(entry.result, entry.targetPlayer, entry.sourcePlayer);
            }
        }
    }

    if (SETTINGS.raycast.type === 'MAIN_THREAD') {
        const rayResult = generateRayCast(player, { type: RaycastTypes.CORNERS });
        if (SETTINGS.renderer === 'pixi' && rayResult) updatePixiFogOfWar(rayResult.vertices, rayResult.count);
        hideFOVCone();
        hidePixiFOVCone();
        tickAdaptiveQuality(timestamp);
    } else if (SETTINGS.raycast.type === 'SPRAY') {
        const rayResult = generateRayCast(player, { type: RaycastTypes.SPRAY });
        if (SETTINGS.renderer === 'pixi' && rayResult) updatePixiFogOfWar(rayResult.vertices, rayResult.count);
        hideFOVCone();
        hidePixiFOVCone();
    } else {
        generateFOVCone(player);
        if (!_cachedFogEl) _cachedFogEl = document.getElementById('fog-of-war');
        _cachedFogEl?.classList.add('d-none');
        if (SETTINGS.renderer === 'pixi') {
            hidePixiFog();
            updatePixiFOVCone(player);
        }
    }

    if (SETTINGS.renderer === 'pixi') updateLighting();

    const shots = adapter.mode === 'offline' ? offlineAdapter.authSim.getConsecutiveShots(player.id) : 0;
    if (SETTINGS.renderer === 'pixi') {
        updatePixiAimLine(player, shots);
        updatePixiGrenadeAimLine(player);
    } else {
        updateAimLine(player, shots);
        updateGrenadeAimLine(player);
    }

    updateHUD(player, adapter.getMatchTimeRemaining());
}
