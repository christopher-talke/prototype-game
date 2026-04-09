import { app, SETTINGS } from '../app';
import { computeRaycastPolygon, computeFOVCone } from '@simulation/detection/raycast';

let _fogOfWarEl: HTMLElement | null = null;

function applyFogOfWarClipPath(polygonPath: string) {
    if (!_fogOfWarEl) _fogOfWarEl = document.getElementById('fog-of-war');
    if (_fogOfWarEl) _fogOfWarEl.style.clipPath = polygonPath;
}

export function generateRayCast(playerInfo: player_info, config: raycast_config) {
    const polygon = computeRaycastPolygon(playerInfo, config);
    if (polygon) applyFogOfWarClipPath(polygon);
}

// FOV cone lines
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

export function hideFOVCone() {
    if (fovLineLeft) fovLineLeft.style.display = 'none';
    if (fovLineRight) fovLineRight.style.display = 'none';
}

// Adaptive quality FPS monitor
const FPS_SAMPLE_WINDOW = 3000;
const FPS_THRESHOLD = 30;
let fpsFrameTimes: number[] = [];
let adaptivePromptDismissed = false;
let adaptiveModalEl: HTMLElement | null = null;

export function tickAdaptiveQuality(timestamp: number) {
    if (adaptivePromptDismissed) return;
    if (SETTINGS.raycast.type !== 'MAIN_THREAD') return;

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
