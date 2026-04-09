// @ts-nocheck
import { GameRoom } from './gameRoom.ts';

export class GameRoomDO {
    constructor(_state: unknown, _env: unknown) {
        this.room = new GameRoom();
        this.sessions = new Map();
    }

    room;
    sessions;

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
            try {
                const msg = JSON.parse(evt.data);
                if (msg?.t === 'join') {
                    this.room.onPlayerJoin(conn, msg.name || 'Player');
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
