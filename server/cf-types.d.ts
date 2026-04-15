/** Cloudflare Workers WebSocket handle, used by the Durable Object adapter. */
interface CFWebSocket {
    accept(): void;
    send(data: string | ArrayBuffer): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: 'message', handler: (evt: { data: string | ArrayBuffer }) => void): void;
    addEventListener(type: 'close', handler: () => void): void;
}

/** Pair of client/server WebSocket handles created by the CF runtime. */
declare class WebSocketPair {
    0: CFWebSocket;
    1: CFWebSocket;
}

/** Cloudflare Workers environment bindings for the game server worker. */
interface CFEnv {
    /** Durable Object namespace for game room instances. */
    GAME_ROOMS: {
        idFromName(name: string): { toString(): string };
        get(id: { toString(): string }): { fetch(request: Request): Promise<Response> };
    };
}
