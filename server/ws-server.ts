import { WebSocketServer } from 'ws';
import { GameRoom, sanitizeName } from './gameRoom';

const MAX_MESSAGE_BYTES = 2048;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 120;

const wss = new WebSocketServer({ port: 8080, maxPayload: MAX_MESSAGE_BYTES });
const rooms = new Map<string, GameRoom>();

type RateState = { count: number; resetAt: number };
const rateLimits = new WeakMap<object, RateState>();

function isRateLimited(ws: object): boolean {
    const now = Date.now();
    let state = rateLimits.get(ws);
    if (!state || now >= state.resetAt) {
        state = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
        rateLimits.set(ws, state);
        return false;
    }
    state.count++;
    return state.count > RATE_LIMIT_MAX_MESSAGES;
}

function parseRoomFromUrl(url?: string): string {
    if (!url) return 'default';
    const parts = url.split('/').filter(Boolean);
    const roomIdx = parts.indexOf('room');
    if (roomIdx >= 0 && parts[roomIdx + 1]) return parts[roomIdx + 1];
    return 'default';
}

function getRoom(roomId: string): GameRoom {
    const existing = rooms.get(roomId);
    if (existing) return existing;
    const room = new GameRoom();
    rooms.set(roomId, room);
    return room;
}

wss.on('connection', (ws, req) => {
    const roomId = parseRoomFromUrl(req.url);
    const room = getRoom(roomId);
    const conn = {
        id: crypto.randomUUID(),
        send: (msg: string) => ws.send(msg),
        close: () => ws.close(),
    };

    ws.on('message', (data) => {
        if (isRateLimited(ws)) {
            ws.close(4008, 'Rate limit exceeded');
            return;
        }

        try {
            const raw = String(data);
            if (raw.length > MAX_MESSAGE_BYTES) return;

            const msg = JSON.parse(raw);
            if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return;

            if (msg.t === 'join') {
                room.onPlayerJoin(conn, sanitizeName(msg.name));
                return;
            }
            room.onPlayerInput(conn, msg);
        } catch {
            // Ignore malformed packets.
        }
    });

    ws.on('close', () => {
        room.onPlayerLeave(conn);
        if (room.isEmpty()) {
            room.destroy();
            rooms.delete(roomId);
            console.log(`[SERVER] Room '${roomId}' culled (empty)`);
        }
    });
});

setInterval(() => {
    for (const room of rooms.values()) {
        room.tick();
    }
}, 16);

console.log('WebSocket server listening on ws://localhost:8080');
