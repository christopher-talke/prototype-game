/**
 * Map-scoped signal bus -- routes `TriggerEvent.signal` strings from zone
 * runtime emissions to registered listeners. Separate from `gameEventBus`
 * (signals are per-match and map-declared, not the global observability
 * stream). Orchestration layer.
 *
 * Lifecycle: build with the active `MapData.signals[]` at match start;
 * `clear()` on match end. Registration of an unknown signal id throws so
 * stock listener wiring stays honest against the map declaration.
 */

import type { MapSignal } from '@shared/map/MapData';

/** Runtime payload delivered to every listener. */
export interface SignalContext {
    /** Triggering player id when the signal originated from zone overlap; otherwise null. */
    playerId: number | null;
    /** Triggering player's team, if known. */
    teamId?: string;
    /** Source zone id when emitted from a trigger zone. */
    triggerZoneId?: string;
}

export type SignalHandler = (ctx: SignalContext) => void;

export class SignalBus {
    private readonly known: Set<string>;
    private readonly listeners = new Map<string, Set<SignalHandler>>();

    constructor(signals: readonly MapSignal[]) {
        this.known = new Set(signals.map((s) => s.id));
    }

    /** Registers a handler for `signalId`. Throws if the signal isn't declared on the map. */
    on(signalId: string, handler: SignalHandler): () => void {
        if (!this.known.has(signalId)) {
            throw new Error(`SignalBus: unknown signal '${signalId}' (not in MapData.signals)`);
        }
        let set = this.listeners.get(signalId);
        if (!set) {
            set = new Set();
            this.listeners.set(signalId, set);
        }
        set.add(handler);
        return () => {
            set!.delete(handler);
        };
    }

    /** Fires `signalId`. Silent no-op when no listener is registered. */
    emit(signalId: string, ctx: SignalContext): void {
        if (!this.known.has(signalId)) {
            throw new Error(`SignalBus: unknown signal '${signalId}' (not in MapData.signals)`);
        }
        const set = this.listeners.get(signalId);
        if (!set) return;
        for (const h of set) h(ctx);
    }

    /** Drops every listener. Called on match end. */
    clear(): void {
        this.listeners.clear();
    }

    /** Introspection for tests and debug tooling. */
    has(signalId: string): boolean {
        return this.known.has(signalId);
    }
}
