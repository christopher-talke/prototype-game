import './settings.css';

import { SETTINGS } from '../../app';
import { switchRenderer } from '@rendering/rendererSwitch';
import { setMasterVolume, setSfxVolume, setMusicVolume, setMuted } from '@audio/index';
import { removeElements } from '@utils/removeElements';
import { getAllBinds, setKeybind, getKeyDisplayName, ActionId } from './keybinds';

let settingsEl: HTMLElement | null = null;
let isOpen = false;
let listeningRow: HTMLElement | null = null;
let listeningAction: ActionId | null = null;

/** @returns Whether the settings panel is currently visible */
export function isSettingsOpen(): boolean {
    return isOpen;
}

/**
 * Opens the settings panel if closed, or closes it if open. Lazily
 * builds the DOM on first toggle. Dispatches a 'settings-closed'
 * CustomEvent when closing so the main menu can un-dim.
 *
 * UI layer - top-level settings overlay with Controls, Audio, and Game tabs.
 */
export function toggleSettings() {
    if (!settingsEl) buildSettingsUI();
    isOpen = !isOpen;
    settingsEl!.classList.toggle('d-none', !isOpen);
    if (isOpen) refreshKeybindsTab();
}

/**
 * Programmatically closes the settings panel and dispatches the
 * 'settings-closed' event. No-op if already closed.
 */
export function closeSettings() {
    if (!isOpen) return;
    isOpen = false;
    settingsEl?.classList.add('d-none');
    cancelListening();
    document.dispatchEvent(new CustomEvent('settings-closed'));
}

function buildSettingsUI() {
    settingsEl = document.createElement('div');
    settingsEl.id = 'settings-menu';
    settingsEl.classList.add('menu-overlay', 'menu-overlay--translucent', 'd-none');
    settingsEl.innerHTML = `
        <div class="settings-panel-wrapper">
            <div class="settings-header">
                <h2>Settings</h2>
                <button id="settings-close">&times;</button>
            </div>
            <div class="settings-tabs">
                <button class="settings-tab active" data-tab="controls">Controls</button>
                <button class="settings-tab" data-tab="audio">Audio</button>
                <button class="settings-tab" data-tab="game">Game</button>
            </div>
            <div class="settings-body">
                <div class="settings-panel active" data-panel="controls" id="settings-controls"></div>
                <div class="settings-panel" data-panel="audio" id="settings-audio"></div>
                <div class="settings-panel" data-panel="game" id="settings-game"></div>
            </div>
        </div>
    `;
    document.body.appendChild(settingsEl);

    settingsEl.querySelector('#settings-close')!.addEventListener('click', closeSettings);

    settingsEl.querySelectorAll('.settings-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            settingsEl!.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
            settingsEl!.querySelectorAll('.settings-panel').forEach((p) => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = settingsEl!.querySelector(`[data-panel="${tab.getAttribute('data-tab')}"]`);
            panel?.classList.add('active');
        });
    });

    buildAudioTab();
    buildGameTab();
    refreshKeybindsTab();

    window.addEventListener('keydown', onRebindKey);
}

function refreshKeybindsTab() {
    const panel = document.getElementById('settings-controls');
    if (!panel) return;
    const binds = getAllBinds();
    panel.innerHTML = binds
        .map(
            (b) => `
        <div class="keybind-row" data-action="${b.action}">
            <span class="keybind-label">${b.label}</span>
            <button class="keybind-btn">${getKeyDisplayName(b.key)}</button>
        </div>
    `,
        )
        .join('');

    panel.querySelectorAll('.keybind-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            cancelListening();
            const row = (e.target as HTMLElement).closest('.keybind-row') as HTMLElement;
            listeningRow = row;
            listeningAction = row.dataset.action as ActionId;
            btn.classList.add('listening');
            (btn as HTMLElement).textContent = '...';
        });
    });
}

function cancelListening() {
    if (listeningRow) {
        const btn = listeningRow.querySelector('.keybind-btn');
        btn?.classList.remove('listening');
    }
    listeningRow = null;
    listeningAction = null;
}

function onRebindKey(e: KeyboardEvent) {
    if (!listeningAction) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
        cancelListening();
        refreshKeybindsTab();
        return;
    }

    setKeybind(listeningAction, e.key);
    cancelListening();
    refreshKeybindsTab();
}

function buildAudioTab() {
    const panel = document.getElementById('settings-audio')!;
    panel.innerHTML = `
        <div class="settings-row">
            <label>Master Volume</label>
            <input type="range" id="opt-master-vol" min="0" max="100" value="${Math.round(SETTINGS.audio.masterVolume * 100)}">
            <span id="opt-master-vol-val">${Math.round(SETTINGS.audio.masterVolume * 100)}%</span>
        </div>
        <div class="settings-row">
            <label>SFX Volume</label>
            <input type="range" id="opt-sfx-vol" min="0" max="100" value="${Math.round(SETTINGS.audio.sfxVolume * 100)}">
            <span id="opt-sfx-vol-val">${Math.round(SETTINGS.audio.sfxVolume * 100)}%</span>
        </div>
        <div class="settings-row">
            <label>Music Volume</label>
            <input type="range" id="opt-music-vol" min="0" max="100" value="${Math.round(SETTINGS.audio.musicVolume * 100)}">
            <span id="opt-music-vol-val">${Math.round(SETTINGS.audio.musicVolume * 100)}%</span>
        </div>
        <div class="settings-row">
            <label>Mute</label>
            <input type="checkbox" id="opt-mute" ${SETTINGS.audio.muted ? 'checked' : ''}>
        </div>
    `;

    const masterSlider = panel.querySelector('#opt-master-vol') as HTMLInputElement;
    const masterLabel = panel.querySelector('#opt-master-vol-val')!;
    masterSlider.addEventListener('input', () => {
        setMasterVolume(parseInt(masterSlider.value) / 100);
        masterLabel.textContent = `${masterSlider.value}%`;
    });

    const sfxSlider = panel.querySelector('#opt-sfx-vol') as HTMLInputElement;
    const sfxLabel = panel.querySelector('#opt-sfx-vol-val')!;
    sfxSlider.addEventListener('input', () => {
        setSfxVolume(parseInt(sfxSlider.value) / 100);
        sfxLabel.textContent = `${sfxSlider.value}%`;
    });

    const musicSlider = panel.querySelector('#opt-music-vol') as HTMLInputElement;
    const musicLabel = panel.querySelector('#opt-music-vol-val')!;
    musicSlider.addEventListener('input', () => {
        setMusicVolume(parseInt(musicSlider.value) / 100);
        musicLabel.textContent = `${musicSlider.value}%`;
    });

    const muteCheck = panel.querySelector('#opt-mute') as HTMLInputElement;
    muteCheck.addEventListener('change', () => {
        setMuted(muteCheck.checked);
    });
}

function buildGameTab() {
    const panel = document.getElementById('settings-game')!;
    panel.innerHTML = `
        <div class="settings-row">
            <label>Debug</label>
            <select id="opt-debug">
                <option value="false" ${!SETTINGS.debug ? 'selected' : ''}>Disabled</option>
                <option value="true" ${SETTINGS.debug ? 'selected' : ''}>Enabled</option>
            </select>
        </div>
        <div class="settings-row">
            <label>Raycasting</label>
            <select id="opt-raycast">
                <option value="DISABLED" ${SETTINGS.raycast.type === 'DISABLED' ? 'selected' : ''}>Simplified FOV Cone</option>
                <option value="SPRAY" ${SETTINGS.raycast.type === 'SPRAY' ? 'selected' : ''}>Fast Raycasting</option>
                <option value="CORNERS" ${SETTINGS.raycast.type === 'CORNERS' ? 'selected' : ''}>Full Raycasting</option>
            </select>
        </div>
        <div class="settings-row">
            <label>Renderer</label>
            <select id="opt-renderer">
                <option value="dom" ${SETTINGS.renderer === 'dom' ? 'selected' : ''}>DOM (Classic)</option>
                <option value="pixi" ${SETTINGS.renderer === 'pixi' ? 'selected' : ''}>WebGL (PixiJS)</option>
            </select>
        </div>
    `;

    panel.querySelector('#opt-debug')!.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === 'true') {
            SETTINGS.debug = true;
        }

        else {
            removeElements(document.querySelectorAll('.ray'));
            removeElements(document.querySelectorAll('.los'));
            SETTINGS.debug = false;
        }
    });

    panel.querySelector('#opt-raycast')!.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        SETTINGS.raycast.type = val as GameSettings['raycast']['type'];
        if (val === 'DISABLED') {
            removeElements(document.querySelectorAll('.ray'));
            document.getElementById('fog-of-war')?.classList.add('d-none');
        }

        else {
            document.getElementById('fog-of-war')?.classList.remove('d-none');
        }
    });

    panel.querySelector('#opt-renderer')!.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value as RendererType;
        switchRenderer(val);
    });
}
