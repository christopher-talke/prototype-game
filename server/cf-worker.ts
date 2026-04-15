import { GameRoom, sanitizeName } from './gameRoom';

const MAX_MESSAGE_BYTES = 2048;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 120;

type RateState = { count: number; resetAt: number };
type Connection = { id: string; send(msg: string): void; close(): void };

export class GameRoomDO {
    room: GameRoom;
    sessions: Map<CFWebSocket, Connection>;
    rateLimits: Map<CFWebSocket, RateState>;

    constructor(_state: unknown, _env: unknown) {
        this.room = new GameRoom();
        this.sessions = new Map();
        this.rateLimits = new Map();
    }

    _isRateLimited(server: CFWebSocket): boolean {
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

    async fetch(_request: Request): Promise<Response> {
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        server.accept();

        const conn: Connection = {
            id: crypto.randomUUID(),
            send: (msg: string) => server.send(msg),
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

        return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }
}

export default {
    async fetch(request: Request, env: CFEnv): Promise<Response> {
        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean);
        const roomId = parts[0] === 'room' && parts[1] ? parts[1] : 'default';

        const id = env.GAME_ROOMS.idFromName(roomId);
        const stub = env.GAME_ROOMS.get(id);
        return stub.fetch(request);
    },
};
