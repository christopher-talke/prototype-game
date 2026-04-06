import type { NetAdapter } from './NetAdapter';
import type { EventHandler, PlayerInput } from './GameEvent';
import type { ClientMessage, ServerMessage } from './Protocol';
import { gameEventBus } from './GameEvent';
import { getPlayerInfo } from '../Globals/Players';
import { getConfig } from '../Config/activeConfig';

type PendingInput = { seq: number; input: PlayerInput };

export class WebSocketAdapter implements NetAdapter {
    readonly mode = 'online' as const;

    private ws: WebSocket | null = null;
    private inputSeq = 0;
    private pendingInputs: PendingInput[] = [];
    private localPlayerId: number | null = null;
    private connected = false;

    async connect(url = 'ws://localhost:8080/room/local', name = 'Player'): Promise<void> {
        if (this.connected) return;

        await new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(url);
            this.ws = ws;

            ws.addEventListener('open', () => {
                const joinMsg: ClientMessage = { v: 1, t: 'join', name };
                ws.send(JSON.stringify(joinMsg));
            });

            ws.addEventListener('message', (event) => {
                this.handleMessage(event.data);
                if (this.connected) {
                    resolve();
                }
            });

            ws.addEventListener('close', () => {
                this.connected = false;
                this.pendingInputs = [];
                this.localPlayerId = null;
            });

            ws.addEventListener('error', () => {
                reject(new Error('WebSocket connection failed'));
            });
        });
    }

    disconnect(): void {
        if (!this.ws) return;
        if (this.ws.readyState === WebSocket.OPEN) {
            const leaveMsg: ClientMessage = { v: 1, t: 'leave' };
            this.ws.send(JSON.stringify(leaveMsg));
        }
        this.ws.close();
        this.ws = null;
        this.connected = false;
        this.pendingInputs = [];
        this.localPlayerId = null;
    }

    getLocalPlayerId(): number | null {
        return this.localPlayerId;
    }

    onEvent(callback: EventHandler): void {
        gameEventBus.subscribe(callback);
    }

    sendInput(input: PlayerInput): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const seq = this.inputSeq++;
        const msg: ClientMessage = { v: 1, t: 'input', seq, input };
        this.ws.send(JSON.stringify(msg));

        if (input.type === 'MOVE') {
            this.applyLocalPrediction(input);
            this.pendingInputs.push({ seq, input });
        }
    }

    tick(_segments: WallSegment[], _players: player_info[], _timestamp: number): void {
        // Server-authoritative adapter: game events arrive from socket messages.
    }

    private handleMessage(raw: unknown): void {
        const text = typeof raw === 'string' ? raw : String(raw);
        let msg: ServerMessage;
        try {
            msg = JSON.parse(text) as ServerMessage;
        } catch {
            return;
        }

        switch (msg.t) {
            case 'welcome':
                this.connected = true;
                this.localPlayerId = msg.playerId;
                break;
            case 'events':
                gameEventBus.emitAll(msg.events);
                break;
            case 'input_ack':
                this.reconcileInputAck(msg.seq, msg.x, msg.y);
                break;
            case 'snapshot':
                this.applySnapshot(msg.players);
                break;
            case 'player_joined':
            case 'player_left':
            case 'lobby_state':
            case 'game_starting':
                break;
        }
    }

    private applyLocalPrediction(input: Extract<PlayerInput, { type: 'MOVE' }>): void {
        const id = this.localPlayerId ?? input.playerId;
        const player = getPlayerInfo(id);
        if (!player) return;

        const speed = getConfig().player.speed;
        player.current_position.x += input.dx * speed;
        player.current_position.y += input.dy * speed;
    }

    private reconcileInputAck(seq: number, x: number, y: number): void {
        if (this.localPlayerId === null) return;

        const player = getPlayerInfo(this.localPlayerId);
        if (!player) return;

        player.current_position.x = x;
        player.current_position.y = y;

        this.pendingInputs = this.pendingInputs.filter((p) => p.seq > seq);
        const speed = getConfig().player.speed;
        for (const pending of this.pendingInputs) {
            if (pending.input.type !== 'MOVE') continue;
            player.current_position.x += pending.input.dx * speed;
            player.current_position.y += pending.input.dy * speed;
        }
    }

    private applySnapshot(players: { id: number; x: number; y: number; rotation: number }[]): void {
        for (const snapshot of players) {
            const player = getPlayerInfo(snapshot.id);
            if (!player) continue;

            if (snapshot.id === this.localPlayerId) {
                continue;
            }

            player.current_position.x = snapshot.x;
            player.current_position.y = snapshot.y;
            player.current_position.rotation = snapshot.rotation;
        }
    }
}

export const webSocketAdapter = new WebSocketAdapter();
