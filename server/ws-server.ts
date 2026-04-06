// @ts-nocheck
import { WebSocketServer } from 'ws';
import { GameRoom } from './GameRoom.ts';

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map<string, GameRoom>();

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
        try {
            const msg = JSON.parse(String(data));
            if (msg?.t === 'join') {
                room.onPlayerJoin(conn, msg.name || 'Player');
                return;
            }
            room.onPlayerInput(conn, msg);
        } catch {
            // Ignore malformed packets.
        }
    });

    ws.on('close', () => {
        room.onPlayerLeave(conn);
    });
});

setInterval(() => {
    for (const room of rooms.values()) {
        room.tick();
    }
}, 50);

console.log('WebSocket server listening on ws://localhost:8080');
