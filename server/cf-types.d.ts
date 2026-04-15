// Minimal Cloudflare Workers type stubs for cf-worker.ts

interface CFWebSocket {
    accept(): void;
    send(data: string | ArrayBuffer): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: 'message', handler: (evt: { data: string | ArrayBuffer }) => void): void;
    addEventListener(type: 'close', handler: () => void): void;
}

declare class WebSocketPair {
    0: CFWebSocket;
    1: CFWebSocket;
}

interface CFEnv {
    GAME_ROOMS: {
        idFromName(name: string): { toString(): string };
        get(id: { toString(): string }): { fetch(request: Request): Promise<Response> };
    };
}
