// NetAdapter: abstraction layer between game input and simulation.
// Offline mode processes inputs locally. Online mode sends them to a server.

import type { GameEvent, PlayerInput } from './GameEvent';

export interface NetAdapter {
    mode: 'offline' | 'online';

    // Send a player input (movement, fire, etc.) to the authority
    sendInput(input: PlayerInput): void;

    // Subscribe to authoritative game events
    onEvent(callback: (event: GameEvent) => void): void;

    // Tick the simulation (called each frame).
    // In offline mode, advances the local simulation.
    // In online mode, this could handle interpolation/prediction.
    tick(segments: WallSegment[], players: player_info[], timestamp: number): void;

    // Connect to server (online only)
    connect?(): Promise<void>;

    // Disconnect from server (online only)
    disconnect?(): void;
}
