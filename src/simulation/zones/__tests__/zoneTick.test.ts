import { describe, it, expect, vi } from 'vitest';
import type { MapData, Zone, TriggerEvent, FloorTransitionMeta, AudioZoneMeta } from '@shared/map/MapData';
import { tickZones, ZoneTickState, type SignalEmitter, type ZoneTickPlayer } from '@simulation/zones/zoneTick';

function baseMap(): MapData {
    return {
        meta: {
            id: 'm', name: 'm', author: '', version: 1,
            thumbnail: '', gameModes: [], playerCount: { min: 1, max: 1, recommended: 1 },
        },
        bounds: { width: 1000, height: 1000, playableArea: { x: 0, y: 0, width: 1000, height: 1000 }, oobKillMargin: 0 },
        postProcess: {
            bloomIntensity: 0, chromaticAberration: 0,
            ambientLightColor: { r: 0, g: 0, b: 0 }, ambientLightIntensity: 0, vignetteIntensity: 0,
        },
        audio: { ambientLoop: null, reverbProfile: 'none' },
        objectDefs: [], entityDefs: [],
        floors: [
            { id: 'ground', label: 'G', renderOrder: 0 },
            { id: 'upper', label: 'U', renderOrder: 1 },
        ],
        signals: [], layers: [], zones: [], navHints: [],
    };
}

function rect(id: string, type: Zone['type'], x: number, y: number, w: number, h: number, extra: Partial<Zone> = {}): Zone {
    return {
        id, type, label: id,
        polygon: [
            { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
        ],
        ...extra,
    };
}

function trigger(signal: string, overrides: Partial<TriggerEvent> = {}): TriggerEvent {
    return { on: 'enter', signal, target: 'all', once: false, timeout: null, ...overrides };
}

function mockEmitter(): SignalEmitter & { calls: Array<{ id: string; ctx: unknown }> } {
    const calls: Array<{ id: string; ctx: unknown }> = [];
    return {
        calls,
        emit(id, ctx) { calls.push({ id, ctx }); },
    };
}

function player(x: number, y: number, floorId = 'ground', team: string | undefined = undefined): ZoneTickPlayer {
    return { id: 1, x, y, floorId, team };
}

describe('zoneTick point-in-polygon + enter/exit', () => {
    it('fires a trigger on first tick inside, no refire while still inside', () => {
        const map = baseMap();
        map.signals = [{ id: 'g.on', label: 'g' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, { meta: { events: [trigger('g.on')] } })];
        const state = new ZoneTickState();
        const emitter = mockEmitter();
        tickZones(map, [player(50, 50)], state, emitter, 0);
        tickZones(map, [player(50, 50)], state, emitter, 16);
        expect(emitter.calls).toHaveLength(1);
    });

    it('refires after player exits and re-enters', () => {
        const map = baseMap();
        map.signals = [{ id: 'g.on', label: 'g' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, { meta: { events: [trigger('g.on')] } })];
        const state = new ZoneTickState();
        const emitter = mockEmitter();
        tickZones(map, [player(50, 50)], state, emitter, 0);
        tickZones(map, [player(500, 500)], state, emitter, 16);
        tickZones(map, [player(50, 50)], state, emitter, 32);
        expect(emitter.calls).toHaveLength(2);
    });

    it('emits TRIGGER_FIRED for on="enter"', () => {
        const map = baseMap();
        map.signals = [{ id: 'g.on', label: 'g' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, { meta: { events: [trigger('g.on')] } })];
        const state = new ZoneTickState();
        const events = tickZones(map, [player(50, 50)], state, mockEmitter(), 0);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: 'TRIGGER_FIRED', signal: 'g.on', triggerZoneId: 't1', on: 'enter' });
    });

    it('fires on="exit" variant when player leaves', () => {
        const map = baseMap();
        map.signals = [{ id: 'g.off', label: 'g' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, {
            meta: { events: [trigger('g.off', { on: 'exit' })] },
        })];
        const state = new ZoneTickState();
        const emitter = mockEmitter();
        tickZones(map, [player(50, 50)], state, emitter, 0);
        expect(emitter.calls).toHaveLength(0);
        tickZones(map, [player(500, 500)], state, emitter, 16);
        expect(emitter.calls).toHaveLength(1);
    });
});

describe('zoneTick once + timeout gating', () => {
    it('once=true prevents refire even after re-entering', () => {
        const map = baseMap();
        map.signals = [{ id: 'g.on', label: 'g' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, {
            meta: { events: [trigger('g.on', { once: true })] },
        })];
        const state = new ZoneTickState();
        const emitter = mockEmitter();
        tickZones(map, [player(50, 50)], state, emitter, 0);
        tickZones(map, [player(500, 500)], state, emitter, 16);
        tickZones(map, [player(50, 50)], state, emitter, 32);
        expect(emitter.calls).toHaveLength(1);
    });

    it('timeout gates refire until the window elapses', () => {
        const map = baseMap();
        map.signals = [{ id: 'g.on', label: 'g' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, {
            meta: { events: [trigger('g.on', { timeout: 1000 })] },
        })];
        const state = new ZoneTickState();
        const emitter = mockEmitter();

        tickZones(map, [player(50, 50)], state, emitter, 0);
        tickZones(map, [player(500, 500)], state, emitter, 16);
        tickZones(map, [player(50, 50)], state, emitter, 500);
        expect(emitter.calls).toHaveLength(1);

        tickZones(map, [player(500, 500)], state, emitter, 1200);
        tickZones(map, [player(50, 50)], state, emitter, 1300);
        expect(emitter.calls).toHaveLength(2);
    });
});

describe('zoneTick target=team filter', () => {
    it('only fires for the configured team', () => {
        const map = baseMap();
        map.signals = [{ id: 'atk.cap', label: 'atk' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, {
            meta: { events: [trigger('atk.cap', { target: 'team', teamId: 'attackers' })] },
        })];
        const state = new ZoneTickState();
        const emitter = mockEmitter();
        tickZones(map, [{ id: 1, x: 50, y: 50, floorId: 'ground', team: 'defenders' }], state, emitter, 0);
        expect(emitter.calls).toHaveLength(0);
        tickZones(map, [{ id: 2, x: 50, y: 50, floorId: 'ground', team: 'attackers' }], state, emitter, 16);
        expect(emitter.calls).toHaveLength(1);
    });
});

describe('zoneTick floor-transition', () => {
    it('swaps player floorId and emits PLAYER_FLOOR_CHANGED', () => {
        const map = baseMap();
        const meta: FloorTransitionMeta = { fromFloorId: 'ground', toFloorId: 'upper', direction: 'up' };
        map.zones = [rect('ft1', 'floor-transition', 0, 0, 100, 100, { meta: meta as unknown as Record<string, unknown> })];
        const p = player(50, 50);
        const events = tickZones(map, [p], new ZoneTickState(), mockEmitter(), 0);
        expect(p.floorId).toBe('upper');
        expect(events).toEqual([{ type: 'PLAYER_FLOOR_CHANGED', playerId: 1, prevFloorId: 'ground', newFloorId: 'upper' }]);
    });

    it('does not transition when player is not on fromFloorId', () => {
        const map = baseMap();
        const meta: FloorTransitionMeta = { fromFloorId: 'ground', toFloorId: 'upper', direction: 'up' };
        map.zones = [rect('ft1', 'floor-transition', 0, 0, 100, 100, { meta: meta as unknown as Record<string, unknown>, floorId: 'upper' })];
        const p = player(50, 50, 'upper');
        const events = tickZones(map, [p], new ZoneTickState(), mockEmitter(), 0);
        expect(p.floorId).toBe('upper');
        expect(events).toHaveLength(0);
    });
});

describe('zoneTick audio callbacks', () => {
    it('invokes onAudioEnter/onAudioExit with the zone meta', () => {
        const map = baseMap();
        const meta: AudioZoneMeta = { reverbProfile: 'room', ambientLoop: null };
        map.zones = [rect('a1', 'audio', 0, 0, 100, 100, { meta: meta as unknown as Record<string, unknown> })];
        const state = new ZoneTickState();
        const onEnter = vi.fn();
        const onExit = vi.fn();
        tickZones(map, [player(50, 50)], state, mockEmitter(), 0, { onAudioEnter: onEnter, onAudioExit: onExit });
        expect(onEnter).toHaveBeenCalledTimes(1);
        tickZones(map, [player(500, 500)], state, mockEmitter(), 16, { onAudioEnter: onEnter, onAudioExit: onExit });
        expect(onExit).toHaveBeenCalledTimes(1);
    });
});

describe('zoneTick floor filtering', () => {
    it('zones scoped to another floor are skipped', () => {
        const map = baseMap();
        map.signals = [{ id: 'g.on', label: 'g' }];
        map.zones = [rect('t1', 'trigger', 0, 0, 100, 100, {
            floorId: 'upper',
            meta: { events: [trigger('g.on')] },
        })];
        const emitter = mockEmitter();
        tickZones(map, [player(50, 50, 'ground')], new ZoneTickState(), emitter, 0);
        expect(emitter.calls).toHaveLength(0);
        tickZones(map, [player(50, 50, 'upper')], new ZoneTickState(), emitter, 16);
        expect(emitter.calls).toHaveLength(1);
    });
});
