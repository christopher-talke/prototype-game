import './menu.css';
import { GAME_MODES } from '../Config/modes/index';
import { toggleSettings } from '../Settings/settings';
import { webSocketAdapter } from '../Net/WebSocketAdapter';
import { showLobbyScreen, hideLobbyScreen } from '../Net/LobbyScreen';

type Screen = 'main' | 'mode-select' | 'how-to-play';

let menuEl: HTMLElement | null = null;
let selectedModeId = 'tdm';
let onPlayCallback: ((modeId: string) => void) | null = null;

export function showMainMenu(onPlay: (modeId: string) => void) {
    onPlayCallback = onPlay;
    menuEl = document.createElement('div');
    menuEl.id = 'main-menu';
    menuEl.innerHTML = buildHTML();
    document.body.appendChild(menuEl);

    wireEvents();
    showScreen('main');
}

export function hideMainMenu() {
    if (!menuEl) return;
    menuEl.classList.add('fade-out');
    setTimeout(() => {
        menuEl?.remove();
        menuEl = null;
    }, 400);
}

// ---- Screen switching ----

function showScreen(screen: Screen) {
    if (!menuEl) return;
    menuEl.querySelectorAll<HTMLElement>('.menu-panel').forEach((p) => p.classList.remove('active'));
    menuEl.querySelector<HTMLElement>(`#screen-${screen}`)?.classList.add('active');
}

// ---- Event wiring ----

function wireEvents() {
    if (!menuEl) return;

    // Main screen
    menuEl.querySelector('#btn-offline')?.addEventListener('click', () => showScreen('mode-select'));
    menuEl.querySelector('#btn-online')?.addEventListener('click', () => {
        hideMainMenu();
        showLobbyScreen({
            onConnect: async (url, name) => {
                await webSocketAdapter.connect(url, name);
            },
            onDisconnect: () => {
                webSocketAdapter.disconnect();
                hideLobbyScreen();
                showMainMenu(onPlayCallback!);
            },
            onBack: () => {
                showMainMenu(onPlayCallback!);
            },
            onReadyChange: (ready) => webSocketAdapter.sendReady(ready),
            onMovePlayer: (playerId, team) => webSocketAdapter.sendMovePlayer(playerId, team),
            onSetConfig: (config) => webSocketAdapter.sendSetConfig(config),
            onStartGame: () => webSocketAdapter.sendStartGame(),
        });
    });
    menuEl.querySelector('#btn-editor')?.addEventListener('click', () => {
        window.location.href = '/editor.html';
    });
    menuEl.querySelector('#btn-settings')?.addEventListener('click', toggleSettings);
    menuEl.querySelector('#btn-howto')?.addEventListener('click', () => showScreen('how-to-play'));

    // Mode select
    menuEl.querySelectorAll<HTMLElement>('.mode-card').forEach((card) => {
        card.addEventListener('click', () => {
            selectedModeId = card.dataset.modeId ?? 'tdm';
            menuEl?.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
    menuEl.querySelector('#btn-play')?.addEventListener('click', () => {
        onPlayCallback?.(selectedModeId);
    });
    menuEl.querySelector('#btn-back-mode')?.addEventListener('click', () => showScreen('main'));

    // How to play
    menuEl.querySelector('#btn-back-howto')?.addEventListener('click', () => showScreen('main'));
}

// ---- HTML builders ----

function buildHTML(): string {
    return `
        ${buildMainScreen()}
        ${buildModeSelectScreen()}
        ${buildHowToPlayScreen()}
        <div class="menu-version">ALPHA 0.1</div>
    `;
}

function buildMainScreen(): string {
    return `
        <div id="screen-main" class="menu-panel">
            <div class="menu-title">Sightline</div>
            <div class="menu-subtitle">2D Tactical Arena Shooter</div>

            <button id="btn-offline" class="menu-btn">
                Offline
            </button>

            <button id="btn-online" class="menu-btn">
                Online
            </button>

            <button id="btn-editor" class="menu-btn">
                Map Editor
            </button>

            <button id="btn-settings" class="menu-btn">
                Settings
            </button>

            <button id="btn-howto" class="menu-btn">
                How to Play
            </button>
        </div>
    `;
}

function buildModeSelectScreen(): string {
    const cards = GAME_MODES.map(
        (mode) => `
        <button class="mode-card${mode.id === selectedModeId ? ' selected' : ''}" data-mode-id="${mode.id}">
            <div class="mode-card-name">${mode.name}</div>
            <div class="mode-card-desc">${mode.description}</div>
            <div class="mode-card-tags">
                ${mode.tags.map((t) => `<span class="mode-tag">${t}</span>`).join('')}
            </div>
        </button>
    `,
    ).join('');

    return `
        <div id="screen-mode-select" class="menu-panel">
            <div class="menu-section-title">Select Mode</div>
            <div class="mode-grid">${cards}</div>
            <div class="menu-btn-row">
                <button id="btn-back-mode" class="menu-btn">Back</button>
                <button id="btn-play" class="menu-btn primary">Play</button>
            </div>
        </div>
    `;
}

function buildHowToPlayScreen(): string {
    const controls: [string, string][] = [
        ['W A S D', 'Move'],
        ['Mouse', 'Aim'],
        ['Left Click', 'Fire / Hold to auto-fire'],
        ['R', 'Reload'],
        ['1 / 2 / 3', 'Switch weapon'],
        ['B', 'Buy menu'],
        ['G (hold)', 'Charge and throw grenade'],
        ['Scroll wheel', 'Cycle grenade type'],
        ['Tab', 'Leaderboard'],
        ['Esc', 'Close menu'],
    ];

    const rows = controls
        .map(
            ([key, action]) => `
        <tr>
            <td>${key}</td>
            <td>${action}</td>
        </tr>
    `,
        )
        .join('');

    return `
        <div id="screen-how-to-play" class="menu-panel">
            <div class="menu-section-title">Controls</div>
            <table class="how-to-table">
                <tbody>${rows}</tbody>
            </table>

            <div class="menu-section-title">Objective</div>
            <table class="how-to-table">
                <tbody>
                    <tr><td>Win rounds</td><td>Eliminate more enemies than the opposing team before time runs out</td></tr>
                    <tr><td>Economy</td><td>Earn cash per kill. Spend it on better weapons at the buy menu</td></tr>
                    <tr><td>Respawn</td><td>You respawn automatically after ${3}s. Kills still count during the round</td></tr>
                </tbody>
            </table>

            <div class="menu-btn-row">
                <button id="btn-back-howto" class="menu-btn">Back</button>
            </div>
        </div>
    `;
}
