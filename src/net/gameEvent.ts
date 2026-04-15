/**
 * Re-exports event types from the simulation layer and provides the EventBus runtime.
 * Type definitions live in simulation/events.ts (simulation boundary contract).
 * This file owns the EventBus class and the singleton gameEventBus instance.
 */

export type {
    GameEvent,
    BulletSpawnEvent,
    BulletRemovedEvent,
    BulletHitEvent,
    PlayerDamagedEvent,
    PlayerKilledEvent,
    PlayerRespawnEvent,
    GrenadeSpawnEvent,
    GrenadeDetonateEvent,
    GrenadeBounceEvent,
    GrenadeRemovedEvent,
    ExplosionHitEvent,
    FlashEffectEvent,
    SmokeDeployEvent,
    KillFeedEvent,
    RoundStartEvent,
    RoundEndEvent,
    ReloadStartEvent,
    ReloadCompleteEvent,
    PlayerStatusChangedEvent,
    TeamChangedEvent,
    FootstepEvent,
    PlayerInput,
    EventHandler,
} from '@simulation/events';

import type { GameEvent, EventHandler } from '@simulation/events';

// -- Event bus --

export class EventBus {
    private handlers: EventHandler[] = [];

    subscribe(handler: EventHandler): () => void {
        this.handlers.push(handler);
        return () => {
            const i = this.handlers.indexOf(handler);
            if (i >= 0) this.handlers.splice(i, 1);
        };
    }

    emit(event: GameEvent) {
        for (const h of this.handlers) h(event);
    }

    emitAll(events: GameEvent[]) {
        for (const e of events) this.emit(e);
    }
}

// Singleton bus for the game
export const gameEventBus = new EventBus();
