// @ts-nocheck
import { GameRoom, sanitizeName } from './gameRoom.ts';

const MAX_MESSAGE_BYTES = 2048;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 120;

export class GameRoomDO {
    constructor(_state: unknown, _env: unknown) {
        this.room = new GameRoom();
        this.sessions = new Map();
        this.rateLimits = new Map();
    }

    room;
    sessions;
    rateLimits;

    _isRateLimited(server) {
        const now = Date.now();
        let state = this.rateLimits.get(server);
        if (!state || now >= state.resetAt) {
            state = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
            this.rateLimits.set(server, state);
            return false;
        }
        state.count++;
        return state.count > RATE_LIMIT_MAX_MESSAGES;
    }

    async fetch(request) {
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        server.accept();

        const conn = {
            id: crypto.randomUUID(),
            send: (msg) => server.send(msg),
            close: () => server.close(),
        };

        this.sessions.set(server, conn);

        server.addEventListener('message', (evt) => {
            if (this._isRateLimited(server)) {
                server.close(4008, 'Rate limit exceeded');
                return;
            }

            try {
                const raw = typeof evt.data === 'string' ? evt.data : String(evt.data);
                if (raw.length > MAX_MESSAGE_BYTES) return;

                const msg = JSON.parse(raw);
                if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return;

                if (msg.t === 'join') {
                    this.room.onPlayerJoin(conn, sanitizeName(msg.name));
                    return;
                }
                this.room.onPlayerInput(conn, msg);
            } catch {
                // Ignore malformed packets.
            }
        });

        server.addEventListener('close', () => {
            this.room.onPlayerLeave(conn);
            this.sessions.delete(server);
            this.rateLimits.delete(server);
        });

        return new Response(null, { status: 101, webSocket: client });
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean);
        const roomId = parts[0] === 'room' && parts[1] ? parts[1] : 'default';

        const id = env.GAME_ROOMS.idFromName(roomId);
        const stub = env.GAME_ROOMS.get(id);
        return stub.fetch(request);
    },
};
