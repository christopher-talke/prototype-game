import './lobby.css';
import type { GameModeConfig, DeepPartial } from '@config/types';
import type { LobbyPlayer } from '@net/protocol';
import { createGameCustomizer, type GameCustomizerInstance } from '@ui/gameCustomizer/gameCustomizer';

type LobbyStateView = {
    host: number;
    players: LobbyPlayer[];
    config: GameModeConfig;
    mapName: string;
    started: boolean;
    roomCode?: string;
};

type LobbyCallbacks = {
    onConnect: (serverUrl: string, name: string) => Promise<void>;
    onDisconnect: () => void;
    onBack: () => void;
    onReadyChange: (ready: boolean) => void;
    onMovePlayer: (playerId: number, team: number) => void;
    onSetConfig: (config: DeepPartial<GameModeConfig>) => void;
    onStartGame: () => void;
};

let rootEl: HTMLElement | null = null;
let callbacks: LobbyCallbacks | null = null;
let selfId = -1;
let ready = false;
let currentState: LobbyStateView | null = null;
let phase: 'connect' | 'room' = 'connect';
let connecting = false;
let connectError = '';
let lobbyCustomizer: GameCustomizerInstance | null = null;

export function getLobbyState(): LobbyStateView | null {
    return currentState;
}

// ---- Public API ----

export function showLobbyScreen(cb: LobbyCallbacks) {
    callbacks = cb;
    selfId = -1;
    ready = false;
    currentState = null;
    phase = 'connect';
    connecting = false;
    connectError = '';

    if (!rootEl) {
        rootEl = document.createElement('div');
        rootEl.id = 'lobby-screen';
        rootEl.classList.add('menu-overlay');
        document.body.appendChild(rootEl);
    }

    render();
}

export function hideLobbyScreen() {
    if (!rootEl) return;
    if (lobbyCustomizer) {
        lobbyCustomizer.unmount();
        lobbyCustomizer = null;
    }
    rootEl.classList.add('fade-out');
    setTimeout(() => {
        rootEl?.remove();
        rootEl = null;
    }, 400);
}

export function setLocalPlayerId(id: number) {
    selfId = id;
}

export function updateLobbyState(state: LobbyStateView) {
    currentState = state;
    if (phase !== 'room') {
        phase = 'room';
    }
    render();
}

export function showCountdown(seconds: number) {
    if (!rootEl) return;
    const el = rootEl.querySelector('.lobby-status');
    if (el) {
        el.className = 'lobby-status countdown';
        el.textContent = `GAME STARTING IN ${seconds}...`;
    }
}

// ---- Rendering ----

function render() {
    if (!rootEl) return;
    rootEl.classList.remove('fade-out');

    if (phase === 'connect') {
        renderConnectForm();
    } else {
        renderRoom();
    }
}

function renderConnectForm() {
    if (!rootEl) return;

    rootEl.innerHTML = `
        <div class="lobby-connect">
            <div class="lobby-connect-title">Online</div>
            <div class="lobby-field">
                <label for="lobby-name">Player Name</label>
                <input type="text" id="lobby-name" placeholder="Player" maxlength="20" value="" />
            </div>
            <div class="lobby-field">
                <label for="lobby-room-code">Room Code</label>
                <input type="text" id="lobby-room-code" placeholder="default" maxlength="30" value="" />
            </div>
            <div class="lobby-field">
                <label for="lobby-server">Server</label>
                <input type="text" id="lobby-server" placeholder="ws://localhost:8080" value="ws://localhost:8080" />
            </div>
            <div class="lobby-error">${connectError}</div>
            <div class="lobby-btn-row">
                <button class="lobby-btn" id="lobby-back">Back</button>
                <button class="lobby-btn primary" id="lobby-join" ${connecting ? 'disabled' : ''}>
                    ${connecting ? 'Connecting...' : 'Join'}
                </button>
            </div>
        </div>
    `;

    rootEl.querySelector('#lobby-back')?.addEventListener('click', () => {
        hideLobbyScreen();
        callbacks?.onBack();
    });

    rootEl.querySelector('#lobby-join')?.addEventListener('click', async () => {
        if (connecting) return;

        const nameInput = rootEl?.querySelector('#lobby-name') as HTMLInputElement;
        const codeInput = rootEl?.querySelector('#lobby-room-code') as HTMLInputElement;
        const serverInput = rootEl?.querySelector('#lobby-server') as HTMLInputElement;

        const name = nameInput?.value.trim() || 'Player';
        const code = codeInput?.value.trim() || 'default';
        const server = serverInput?.value.trim() || 'ws://localhost:8080';
        const url = `${server}/room/${encodeURIComponent(code)}`;

        connecting = true;
        connectError = '';
        render();

        try {
            await callbacks?.onConnect(url, name);
        } catch {
            connectError = 'Could not connect to server.';
            connecting = false;
            render();
        }
    });

    (rootEl.querySelector('#lobby-name') as HTMLInputElement)?.focus();
}

function renderRoom() {
    if (!rootEl || !currentState) return;

    const state = currentState;
    const isHost = state.host === selfId;
    const team1 = state.players.filter((p) => p.team === 1);
    const team2 = state.players.filter((p) => p.team === 2);

    rootEl.innerHTML = `
        <div class="lobby-room">
            <div class="lobby-header">
                <div class="lobby-room-title">Room Lobby</div>
                <div class="lobby-room-code">Room: ${state.roomCode ?? '---'} / Map: ${state.mapName}</div>
            </div>

            <div class="lobby-teams">
                <div class="lobby-team team-1">
                    <div class="lobby-team-header">Team 1</div>
                    ${team1.map((p) => renderPlayer(p, isHost, 2)).join('')}
                    ${team1.length === 0 ? '<div style="font-size:11px; color:rgba(255,255,255,0.15); padding:8px 0;">No players</div>' : ''}
                </div>
                <div class="lobby-team team-2">
                    <div class="lobby-team-header">Team 2</div>
                    ${team2.map((p) => renderPlayer(p, isHost, 1)).join('')}
                    ${team2.length === 0 ? '<div style="font-size:11px; color:rgba(255,255,255,0.15); padding:8px 0;">No players</div>' : ''}
                </div>
            </div>

            <div class="lobby-config">
                <div class="lobby-config-title">Match Config</div>
                <div id="lobby-customizer-mount"></div>
            </div>

            <div class="lobby-actions">
                <button class="lobby-btn danger" id="lobby-leave">Leave</button>
                ${isHost ? '<button class="lobby-btn" id="lobby-apply">Apply Config</button>' : ''}
                <button class="lobby-btn ${ready ? '' : 'primary'}" id="lobby-ready">${ready ? 'Unready' : 'Ready'}</button>
                ${isHost ? '<button class="lobby-btn primary" id="lobby-start">Start Game</button>' : ''}
            </div>

            <div class="lobby-status">Waiting for players...</div>
        </div>
    `;

    // Mount customizer
    const custMount = rootEl.querySelector<HTMLElement>('#lobby-customizer-mount');
    if (custMount) {
        if (lobbyCustomizer) lobbyCustomizer.unmount();
        lobbyCustomizer = createGameCustomizer({
            container: custMount,
            readonly: !isHost,
            showAISection: false,
            compact: true,
        });
        lobbyCustomizer.mount();
        lobbyCustomizer.applyConfig(state.config);
    }

    rootEl.querySelectorAll<HTMLButtonElement>('[data-action="swap"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const playerId = Number(btn.dataset.player);
            const toTeam = Number(btn.dataset.team);
            callbacks?.onMovePlayer(playerId, toTeam);
        });
    });

    rootEl.querySelector('#lobby-leave')?.addEventListener('click', () => {
        if (lobbyCustomizer) {
            lobbyCustomizer.unmount();
            lobbyCustomizer = null;
        }
        callbacks?.onDisconnect();
        phase = 'connect';
        connecting = false;
        ready = false;
        currentState = null;
        render();
    });

    rootEl.querySelector('#lobby-ready')?.addEventListener('click', () => {
        ready = !ready;
        callbacks?.onReadyChange(ready);
    });

    rootEl.querySelector('#lobby-apply')?.addEventListener('click', () => {
        const overrides = lobbyCustomizer?.getValue() ?? {};
        callbacks?.onSetConfig(overrides);
    });

    rootEl.querySelector('#lobby-start')?.addEventListener('click', () => {
        callbacks?.onStartGame();
    });
}

function renderPlayer(p: LobbyPlayer, isHost: boolean, otherTeam: number): string {
    const isSelf = p.id === selfId;
    return `
        <div class="lobby-player">
            <span class="lobby-player-name">${p.name}${isSelf ? ' (you)' : ''}</span>
            <div class="lobby-player-tags">
                ${p.isHost ? '<span class="lobby-player-tag host">HOST</span>' : ''}
                <span class="lobby-player-tag ${p.ready ? 'ready' : 'not-ready'}">${p.ready ? 'READY' : '---'}</span>
                ${isHost ? `<button class="lobby-swap-btn" data-action="swap" data-player="${p.id}" data-team="${otherTeam}">&#8644;</button>` : ''}
            </div>
        </div>
    `;
}
