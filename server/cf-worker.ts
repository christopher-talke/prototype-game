import { GameRoom, sanitizeName } from './gameRoom';

const MAX_MESSAGE_BYTES = 2048;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 120;

type RateState = { count: number; resetAt: number };
type Connection = { id: string; send(msg: string): void; close(): void };

/**
 * Cloudflare Durable Object that hosts a single game room. Each WebSocket
 * upgrade creates a `Connection` wrapper and delegates to the shared
 * `GameRoom` instance for lobby/game logic.
 *
 * Server layer - CF Worker entry point. Mirrors `ws-server.ts` for the
 * standalone WebSocket server.
 */
export class GameRoomDO {
    room: GameRoom;
    sessions: Map<CFWebSocket, Connection>;
    rateLimits: Map<CFWebSocket, RateState>;

    /**
     * @param _state - Durable Object state (unused, no persistent storage)
     * @param _env - Worker environment bindings (unused in the DO itself)
     */
    constructor(_state: unknown, _env: unknown) {
        this.room = new GameRoom();
        this.sessions = new Map();
        this.rateLimits = new Map();
    }

    /**
     * Checks whether a connection has exceeded the per-window message rate
     * limit. Resets the counter after each window expires.
     * @param server - The server-side CFWebSocket to check
     * @returns True if the connection should be throttled
     */
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

    /**
     * Handles an incoming HTTP request by upgrading it to a WebSocket.
     * Wires message and close handlers through to the `GameRoom`.
     * @param _request - The incoming HTTP upgrade request
     * @returns A 101 Switching Protocols response with the client socket
     */
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
    /**
     * Worker fetch handler. Routes `/room/<roomId>` requests to the
     * corresponding Durable Object instance.
     * @param request - Incoming HTTP request
     * @param env - CF environment bindings with GAME_ROOMS namespace
     * @returns Proxied response from the Durable Object
     */
    async fetch(request: Request, env: CFEnv): Promise<Response> {
        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean);
        const roomId = parts[0] === 'room' && parts[1] ? parts[1] : 'default';

        const id = env.GAME_ROOMS.idFromName(roomId);
        const stub = env.GAME_ROOMS.get(id);
        return stub.fetch(request);
    },
};
