/**
 * Per-tick zone overlap evaluation. Simulation layer.
 *
 * Produces enter/exit transitions for each player against each zone active on
 * their current floor. Trigger zones fire signal-bus emissions, floor
 * transitions mutate player floor and emit PLAYER_FLOOR_CHANGED, audio zones
 * record enter/exit for the client-side listener. Edge tracking state is kept
 * inside a `ZoneTickState` instance and reused across ticks.
 */

import type { GameEvent } from '@simulation/events';
import type {
    MapData,
    Vec2,
    Zone,
    TriggerEvent,
    FloorTransitionMeta,
    AudioZoneMeta,
} from '@shared/map/MapData';

/**
 * Minimal signal-emit port. The actual bus lives in orchestration; simulation
 * depends on the interface only, preserving the inward-dependency rule.
 */
export interface SignalEmitter {
    emit(signalId: string, ctx: {
        playerId: number | null;
        teamId?: string;
        triggerZoneId?: string;
    }): void;
}

/** Minimal player view the zone tick needs. Mutated in-place when floors change. */
export interface ZoneTickPlayer {
    id: number;
    x: number;
    y: number;
    floorId: string;
    team?: string;
}

/** Enter/exit + per-trigger arming state preserved across ticks. */
export class ZoneTickState {
    /** `zoneId:playerId` -> currently-inside flag. Using a string key is fine: per-tick cost is O(zones*players). */
    readonly insideByPlayer = new Map<number, Set<string>>();
    /** Trigger-zone consumption: true means `once` has already fired and the zone is inert. */
    readonly consumedOnce = new Set<string>();
    /** Trigger-zone timeout re-arm: zoneId -> earliest wall-clock ms it may fire again. */
    readonly armedAt = new Map<string, number>();
}

/**
 * Runs one tick of zone evaluation. Returns the list of game events produced
 * (TRIGGER_FIRED, PLAYER_FLOOR_CHANGED). Audio zones record enter/exit via
 * the optional `onAudioEnter` / `onAudioExit` callbacks.
 */
export function tickZones(
    map: MapData,
    players: readonly ZoneTickPlayer[],
    state: ZoneTickState,
    signals: SignalEmitter,
    nowMs: number,
    callbacks?: {
        onAudioEnter?: (zone: Zone, meta: AudioZoneMeta, player: ZoneTickPlayer) => void;
        onAudioExit?: (zone: Zone, meta: AudioZoneMeta, player: ZoneTickPlayer) => void;
    },
): GameEvent[] {
    const events: GameEvent[] = [];

    for (const player of players) {
        let inside = state.insideByPlayer.get(player.id);
        if (!inside) {
            inside = new Set();
            state.insideByPlayer.set(player.id, inside);
        }

        for (const zone of map.zones) {
            if (zone.floorId !== undefined && zone.floorId !== player.floorId) {
                if (inside.has(zone.id)) inside.delete(zone.id);
                continue;
            }

            const wasInside = inside.has(zone.id);
            const isInside = pointInPolygon(zone.polygon, player.x, player.y);

            if (isInside && !wasInside) {
                inside.add(zone.id);
                handleEnter(zone, player, events, state, signals, nowMs, callbacks);
            }
            else if (!isInside && wasInside) {
                inside.delete(zone.id);
                handleExit(zone, player, events, state, signals, nowMs, callbacks);
            }
        }
    }

    return events;
}

function handleEnter(
    zone: Zone,
    player: ZoneTickPlayer,
    events: GameEvent[],
    state: ZoneTickState,
    signals: SignalEmitter,
    nowMs: number,
    callbacks?: { onAudioEnter?: (z: Zone, m: AudioZoneMeta, p: ZoneTickPlayer) => void },
): void {
    if (zone.type === 'trigger') {
        fireTriggerEvents(zone, player, 'enter', events, state, signals, nowMs);
    }
    else if (zone.type === 'floor-transition') {
        const meta = zone.meta as FloorTransitionMeta | undefined;
        if (meta) applyFloorTransition(meta, player, events);
    }
    else if (zone.type === 'audio') {
        const meta = zone.meta as AudioZoneMeta | undefined;
        if (meta && callbacks?.onAudioEnter) callbacks.onAudioEnter(zone, meta, player);
    }
}

function handleExit(
    zone: Zone,
    player: ZoneTickPlayer,
    events: GameEvent[],
    state: ZoneTickState,
    signals: SignalEmitter,
    nowMs: number,
    callbacks?: { onAudioExit?: (z: Zone, m: AudioZoneMeta, p: ZoneTickPlayer) => void },
): void {
    if (zone.type === 'trigger') {
        fireTriggerEvents(zone, player, 'exit', events, state, signals, nowMs);
    }
    else if (zone.type === 'audio') {
        const meta = zone.meta as AudioZoneMeta | undefined;
        if (meta && callbacks?.onAudioExit) callbacks.onAudioExit(zone, meta, player);
    }
}

function fireTriggerEvents(
    zone: Zone,
    player: ZoneTickPlayer,
    edge: 'enter' | 'exit',
    events: GameEvent[],
    state: ZoneTickState,
    signals: SignalEmitter,
    nowMs: number,
): void {
    const meta = zone.meta as { events?: TriggerEvent[] } | undefined;
    const triggerList = meta?.events ?? [];
    for (const ev of triggerList) {
        if (ev.on !== edge && ev.on !== 'both') continue;
        if (ev.target === 'team' && ev.teamId !== undefined && player.team !== ev.teamId) continue;

        const gateKey = `${zone.id}:${ev.signal}:${edge}`;
        if (ev.once && state.consumedOnce.has(gateKey)) continue;
        if (ev.timeout !== null) {
            const armedAt = state.armedAt.get(gateKey);
            if (armedAt !== undefined && nowMs < armedAt) continue;
        }

        signals.emit(ev.signal, {
            playerId: player.id,
            teamId: player.team,
            triggerZoneId: zone.id,
        });

        events.push({
            type: 'TRIGGER_FIRED',
            signal: ev.signal,
            triggerZoneId: zone.id,
            triggeringPlayerId: player.id,
            on: edge,
        });

        if (ev.once) state.consumedOnce.add(gateKey);
        if (ev.timeout !== null) state.armedAt.set(gateKey, nowMs + ev.timeout);
    }
}

function applyFloorTransition(meta: FloorTransitionMeta, player: ZoneTickPlayer, events: GameEvent[]): void {
    if (player.floorId !== meta.fromFloorId) return;

    if (meta.direction === 'up' || meta.direction === 'down') {
        // In 'up' / 'down', direction is informational for validators -- the zone still only
        // transitions from fromFloorId to toFloorId. No gating here; validator handles spec.
    }

    const prev = player.floorId;
    player.floorId = meta.toFloorId;
    events.push({
        type: 'PLAYER_FLOOR_CHANGED',
        playerId: player.id,
        prevFloorId: prev,
        newFloorId: meta.toFloorId,
    });
}

function pointInPolygon(polygon: readonly Vec2[], x: number, y: number): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}
