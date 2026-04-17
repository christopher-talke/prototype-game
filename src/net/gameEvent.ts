/**
 * Re-exports event types from the simulation layer and provides the EventBus runtime.
 *
 * Net layer - type definitions live in simulation/events.ts (the simulation
 * boundary contract). This file owns the {@link EventBus} class and the
 * singleton {@link gameEventBus} instance that bridges simulation events to
 * rendering, audio, and HUD subscribers.
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
    EntityStateChangedEvent,
    PlayerInput,
    EventHandler,
} from '@simulation/events';

import type { GameEvent, EventHandler } from '@simulation/events';

/**
 * Publish-subscribe event bus for {@link GameEvent} instances.
 *
 * Net layer - decouples the simulation from rendering, audio, and HUD.
 * Subscribers receive every event in emission order. The bus does not filter
 * or transform events.
 */
export class EventBus {
    private handlers: EventHandler[] = [];

    /**
     * Registers a handler that will be called for every emitted event.
     * @param handler - Callback invoked with each {@link GameEvent}.
     * @returns An unsubscribe function that removes this handler.
     */
    subscribe(handler: EventHandler): () => void {
        this.handlers.push(handler);
        return () => {
            const i = this.handlers.indexOf(handler);
            if (i >= 0) this.handlers.splice(i, 1);
        };
    }

    /**
     * Broadcasts a single event to all subscribers.
     * @param event - The event to emit.
     */
    emit(event: GameEvent) {
        for (const h of this.handlers) h(event);
    }

    /**
     * Broadcasts every event in the array, in order.
     * @param events - Array of events to emit.
     */
    emitAll(events: GameEvent[]) {
        for (const e of events) this.emit(e);
    }
}

/** Global event bus shared across the entire client. */
export const gameEventBus = new EventBus();
