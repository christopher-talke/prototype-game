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

let _cachedFogEl: HTMLElement | null = null;

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
    } else {
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
    } else {
        setCameraTarget(player.current_position.x, player.current_position.y);
        setCameraWeaponOffset(cameraOffset, facingRad);
        updateCamera(vpWidth, vpHeight);
    }

    for (let i = 0; i < detections.count; i++) {
        const entry = detections.entries[i];
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

    if (SETTINGS.raycast.type === 'CORNERS') {
        const rayResult = generateRayCast(player, { type: RaycastTypes.CORNERS });
        if (SETTINGS.renderer === 'pixi' && rayResult) updatePixiFogOfWar(rayResult.vertices, rayResult.count);
        hideFOVCone();
        tickAdaptiveQuality(timestamp);
    } else if (SETTINGS.raycast.type === 'SPRAY') {
        const rayResult = generateRayCast(player, { type: RaycastTypes.SPRAY });
        if (SETTINGS.renderer === 'pixi' && rayResult) updatePixiFogOfWar(rayResult.vertices, rayResult.count);
        hideFOVCone();
    } else {
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
    } else {
        updateAimLine(player, shots);
        updateGrenadeAimLine(player, grenadeChargePercent, selectedGrenadeType);
    }

    updateHUD(player, adapter.getMatchTimeRemaining(), selectedGrenadeType);
}
