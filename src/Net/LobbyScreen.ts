import type { DeepPartial, GameModeConfig } from '../Config/types';
import type { LobbyPlayer } from './Protocol';

export type LobbyStateView = {
    host: number;
    players: LobbyPlayer[];
    config: GameModeConfig;
    mapName: string;
    started: boolean;
};

type LobbyCallbacks = {
    onReadyChange?: (ready: boolean) => void;
    onMovePlayer?: (playerId: number, team: number) => void;
    onSetConfig?: (config: DeepPartial<GameModeConfig>) => void;
    onSetMap?: (mapName: string) => void;
    onStartGame?: () => void;
};

let rootEl: HTMLElement | null = null;
let callbacks: LobbyCallbacks = {};
let selfId = -1;
let ready = false;

export function showLobbyScreen(playerId: number, initialState: LobbyStateView, cb: LobbyCallbacks = {}) {
    selfId = playerId;
    callbacks = cb;

    if (!rootEl) {
        rootEl = document.createElement('div');
        rootEl.id = 'lobby-screen';
        Object.assign(rootEl.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '9800',
            background: 'rgba(8, 12, 18, 0.94)',
            color: '#f3f4f6',
            fontFamily: "'Courier New', monospace",
            padding: '20px',
            overflow: 'auto',
        });
        document.body.appendChild(rootEl);
    }

    updateLobbyScreen(initialState);
}

export function hideLobbyScreen() {
    rootEl?.remove();
    rootEl = null;
}

export function updateLobbyScreen(state: LobbyStateView) {
    if (!rootEl) return;

    const isHost = state.host === selfId;
    rootEl.innerHTML = `
        <div style="max-width: 980px; margin: 0 auto; display: grid; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 22px; letter-spacing: 1px;">Room Lobby</h2>
                <div>Map: <strong>${state.mapName}</strong></div>
            </div>

            <div style="display: grid; gap: 8px; border: 1px solid rgba(255,255,255,.2); padding: 12px; background: rgba(255,255,255,.03);">
                <div style="font-size: 14px; opacity: .9;">Players</div>
                ${state.players
                    .map((p) => {
                        const canMove = isHost && !state.started;
                        return `
                            <div style="display:flex; align-items:center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,.08); padding-top: 8px;">
                                <div>
                                    <strong>${p.name}</strong>
                                    ${p.isHost ? '<span style="opacity:.7; margin-left: 8px;">(host)</span>' : ''}
                                    <span style="opacity:.7; margin-left: 8px;">${p.ready ? 'ready' : 'not ready'}</span>
                                </div>
                                <div style="display:flex; gap: 8px; align-items:center;">
                                    <span style="opacity:.8;">Team ${p.team}</span>
                                    <button ${canMove ? '' : 'disabled'} data-action="move" data-player="${p.id}" data-team="1">T1</button>
                                    <button ${canMove ? '' : 'disabled'} data-action="move" data-player="${p.id}" data-team="2">T2</button>
                                </div>
                            </div>
                        `;
                    })
                    .join('')}
            </div>

            <div style="display: grid; gap: 8px; border: 1px solid rgba(255,255,255,.2); padding: 12px; background: rgba(255,255,255,.03);">
                <div style="font-size: 14px; opacity: .9;">Match Config</div>
                <label style="display:flex; gap: 8px; align-items:center;">
                    <span style="min-width: 140px;">Rounds To Win</span>
                    <input ${isHost ? '' : 'disabled'} id="lobby-rounds" type="number" min="1" max="30" value="${state.config.match.roundsToWin}" />
                </label>
                <label style="display:flex; gap: 8px; align-items:center;">
                    <span style="min-width: 140px;">Round Duration (s)</span>
                    <input ${isHost ? '' : 'disabled'} id="lobby-duration" type="number" min="20" max="1200" value="${Math.floor(state.config.match.roundDuration / 1000)}" />
                </label>
            </div>

            <div style="display:flex; gap: 10px; justify-content: flex-end;">
                <button id="lobby-ready" ${state.started ? 'disabled' : ''}>${ready ? 'Unready' : 'Ready'}</button>
                <button id="lobby-apply" ${isHost && !state.started ? '' : 'disabled'}>Apply Config</button>
                <button id="lobby-start" ${isHost && !state.started ? '' : 'disabled'}>Start Game</button>
            </div>
        </div>
    `;

    rootEl.querySelectorAll<HTMLButtonElement>('button[data-action="move"]').forEach((button) => {
        button.addEventListener('click', () => {
            const playerId = Number(button.dataset.player);
            const team = Number(button.dataset.team);
            callbacks.onMovePlayer?.(playerId, team);
        });
    });

    rootEl.querySelector('#lobby-ready')?.addEventListener('click', () => {
        ready = !ready;
        callbacks.onReadyChange?.(ready);
        updateLobbyScreen(state);
    });

    rootEl.querySelector('#lobby-apply')?.addEventListener('click', () => {
        const rounds = Number((rootEl?.querySelector('#lobby-rounds') as HTMLInputElement | null)?.value ?? state.config.match.roundsToWin);
        const durationSec = Number((rootEl?.querySelector('#lobby-duration') as HTMLInputElement | null)?.value ?? Math.floor(state.config.match.roundDuration / 1000));
        callbacks.onSetConfig?.({
            match: {
                roundsToWin: rounds,
                roundDuration: durationSec * 1000,
            },
        });
    });

    rootEl.querySelector('#lobby-start')?.addEventListener('click', () => {
        callbacks.onStartGame?.();
    });
}
