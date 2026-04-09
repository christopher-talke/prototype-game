import { angleToRadians } from '../utils/angleToRadians';
import { ROTATION_OFFSET } from '../constants';
import { SETTINGS } from '../app';
import { detectOtherPlayers } from '@simulation/detection/detection';
import { getPlayerElement } from '@rendering/playerElements';
import { applyVisibility, updateLastKnown, debugLineOfSight } from '@rendering/visibilityRenderer';
import { generateRayCast, generateFOVCone, hideFOVCone, tickAdaptiveQuality, RaycastTypes } from '@rendering/raycastRenderer';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getWeaponDef } from '@simulation/combat/weapons';
import { updateSmokeClouds } from '@rendering/smokeRenderer';
import { removeExpiredSmoke } from '@simulation/combat/smokeData';
import { clientRenderer } from '@net/ClientRenderer';
import { updateAimLine } from './aimLineRenderer';
import { setCameraTarget, setCameraWeaponOffset, updateCamera } from './Camera';
import { updateHUD } from './hud/hud';
import { offlineAdapter } from '@net/OfflineAdapter';
import type { NetAdapter } from '@net/NetAdapter';

let _cachedFogEl: HTMLElement | null = null;

export function updateRenderPipeline(player: player_info, adapter: NetAdapter, timestamp: number) {
    // Sim-adjacent per-frame updates
    clientRenderer.updateVisuals();
    removeExpiredSmoke(timestamp);
    updateSmokeClouds(timestamp);

    // Camera
    const weapon = getActiveWeapon(player);
    const weaponDef = weapon ? getWeaponDef(weapon.type) : null;
    const cameraOffsetDist = weaponDef ? weaponDef.cameraOffset : 0;
    setCameraTarget(player.current_position.x, player.current_position.y);
    setCameraWeaponOffset(cameraOffsetDist, angleToRadians(player.current_position.rotation - ROTATION_OFFSET));
    updateCamera(window.visualViewport!.width, window.visualViewport!.height);

    // Detection / visibility: compute results (pure) then apply to DOM
    const detections = detectOtherPlayers(player.id);
    for (const entry of detections) {
        const targetEl = getPlayerElement(entry.targetId);
        if (SETTINGS.debug) {
            debugLineOfSight(entry.blocked, entry.targetPlayer, entry.sourcePlayer, targetEl);
        } else {
            if (targetEl) applyVisibility(entry.result, targetEl);
            updateLastKnown(entry.result, entry.targetPlayer, entry.sourcePlayer);
        }
    }

    // Raycasting / FOV
    if (SETTINGS.raycast.type === 'MAIN_THREAD') {
        generateRayCast(player, { type: RaycastTypes.CORNERS });
        hideFOVCone();
        tickAdaptiveQuality(timestamp);
    } else if (SETTINGS.raycast.type === 'SPRAY') {
        generateRayCast(player, { type: RaycastTypes.SPRAY });
        hideFOVCone();
    } else {
        generateFOVCone(player);
        if (!_cachedFogEl) _cachedFogEl = document.getElementById('fog-of-war');
        _cachedFogEl?.classList.add('d-none');
    }

    // Aim line
    const shots = adapter.mode === 'offline' ? offlineAdapter.authSim.getConsecutiveShots(player.id) : 0;
    updateAimLine(player, shots);

    // HUD
    updateHUD(player, adapter.getMatchTimeRemaining());
}
