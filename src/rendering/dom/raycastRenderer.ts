/**
 * DOM raycast renderer. Computes the visibility polygon for the local player
 * and applies it as a CSS clip-path on the fog-of-war overlay. Also renders
 * FOV cone debug lines and includes an adaptive quality FPS monitor that
 * prompts the user to reduce settings when frame rate drops.
 * Part of the DOM rendering layer.
 */

import { app, SETTINGS } from '../../app';
import { computeRaycastPolygon, computeFOVCone } from '@simulation/detection/raycast';

let _fogOfWarEl: HTMLElement | null = null;
let polyStringParts: string[] = [];

/**
 * Applies the computed visibility polygon as a CSS clip-path on the fog-of-war
 * element. Reuses a pre-allocated string array to minimize allocations.
 * @param vertices - Polygon vertices in world coordinates
 * @param count - Number of valid vertices in the array
 */
function applyFogOfWarClipPath(vertices: coordinates[], count: number) {
    if (!_fogOfWarEl) _fogOfWarEl = document.getElementById('fog-of-war');
    if (!_fogOfWarEl) return;
    if (polyStringParts.length < count) polyStringParts = new Array(count);
    for (let i = 0; i < count; i++) {
        polyStringParts[i] = `${Math.round(vertices[i].x)}px ${Math.round(vertices[i].y)}px`;
    }
    _fogOfWarEl.style.clipPath = 'polygon(' + polyStringParts.slice(0, count).join(',') + ')';
}

/**
 * Computes the raycast visibility polygon for a player and applies it to the
 * fog-of-war overlay.
 * @param playerInfo - The local player's state (position + rotation)
 * @param config - Raycast configuration (type, ray count, range)
 * @returns The visibility polygon vertices and count, or null if raycast failed
 */
export function generateRayCast(playerInfo: player_info, config: raycast_config): { vertices: coordinates[]; count: number } | null {
    const result = computeRaycastPolygon(playerInfo, config);
    if (result) applyFogOfWarClipPath(result.vertices, result.count);

    return result;
}

let fovLineLeft: HTMLElement | null = null;
let fovLineRight: HTMLElement | null = null;

function ensureFOVLineElements() {
    if (app === undefined) return;

    if (fovLineLeft) return;
    fovLineLeft = document.createElement('div');
    fovLineLeft.classList.add('fov-line');
    app.appendChild(fovLineLeft);

    fovLineRight = document.createElement('div');
    fovLineRight.classList.add('fov-line');
    app.appendChild(fovLineRight);
}

/**
 * Renders two lines marking the edges of the player's field-of-view cone.
 * Used as a debug visualization.
 * @param playerInfo - The local player's state
 */
export function generateFOVCone(playerInfo: player_info) {
    ensureFOVLineElements();
    const cone = computeFOVCone(playerInfo);

    fovLineLeft!.style.display = 'block';
    fovLineLeft!.style.left = `${cone.cx}px`;
    fovLineLeft!.style.top = `${cone.cy}px`;
    fovLineLeft!.style.width = `${cone.leftLen}px`;
    fovLineLeft!.style.transform = `rotate(${cone.lowerAngle}deg)`;

    fovLineRight!.style.display = 'block';
    fovLineRight!.style.left = `${cone.cx}px`;
    fovLineRight!.style.top = `${cone.cy}px`;
    fovLineRight!.style.width = `${cone.rightLen}px`;
    fovLineRight!.style.transform = `rotate(${cone.upperAngle}deg)`;
}

/** Hides the FOV cone debug lines. */
export function hideFOVCone() {
    if (fovLineLeft) fovLineLeft.style.display = 'none';
    if (fovLineRight) fovLineRight.style.display = 'none';
}

const FPS_SAMPLE_WINDOW = 3000;
const FPS_THRESHOLD = 30;
let fpsFrameTimes: number[] = [];
let adaptivePromptDismissed = false;
let adaptiveModalEl: HTMLElement | null = null;

/**
 * Tracks frame timestamps and shows a quality reduction prompt if average FPS
 * drops below the threshold over the sample window. Only fires once per session
 * and only when using the CORNERS raycast type.
 * @param timestamp - Current frame timestamp from requestAnimationFrame
 */
export function tickAdaptiveQuality(timestamp: number) {
    if (adaptivePromptDismissed) return;
    if (SETTINGS.raycast.type !== 'CORNERS') return;

    fpsFrameTimes.push(timestamp);

    const cutoff = timestamp - FPS_SAMPLE_WINDOW;
    while (fpsFrameTimes.length > 0 && fpsFrameTimes[0] < cutoff) {
        fpsFrameTimes.shift();
    }

    if (fpsFrameTimes.length < 2) return;
    const elapsed = fpsFrameTimes[fpsFrameTimes.length - 1] - fpsFrameTimes[0];
    if (elapsed < FPS_SAMPLE_WINDOW * 0.9) return;

    const avgFps = (fpsFrameTimes.length - 1) / (elapsed / 1000);
    if (avgFps < FPS_THRESHOLD) {
        showAdaptiveQualityModal();
    }
}

function showAdaptiveQualityModal() {
    if (adaptiveModalEl) return;
    adaptivePromptDismissed = true;

    adaptiveModalEl = document.createElement('div');
    adaptiveModalEl.id = 'adaptive-quality-modal';
    adaptiveModalEl.innerHTML = `
        <div class="aq-title">PERFORMANCE ISSUES DETECTED</div>
        <div class="aq-body">Auto adjust rendering configuration for better performance?</div>
        <div class="aq-buttons">
            <button id="aq-accept">ACCEPT</button>
            <button id="aq-dismiss">DISMISS</button>
        </div>
    `;

    document.body.appendChild(adaptiveModalEl);
    document.getElementById('aq-accept')!.addEventListener('click', () => {
        SETTINGS.raycast.type = 'DISABLED';
        const fogOfWar = document.getElementById('fog-of-war');
        if (fogOfWar) fogOfWar.classList.remove('d-none');
        removeAdaptiveModal();
        const dropdown = document.getElementById('opt-raycast') as HTMLSelectElement | null;
        if (dropdown) dropdown.value = 'DISABLED';
    });

    document.getElementById('aq-dismiss')!.addEventListener('click', () => {
        removeAdaptiveModal();
    });
}

function removeAdaptiveModal() {
    if (adaptiveModalEl) {
        adaptiveModalEl.remove();
        adaptiveModalEl = null;
    }
}

export { RaycastTypes } from '@simulation/detection/raycast';
