import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '@net/gameEvent';
import type { GameEvent } from '@net/gameEvent';

let bus: EventBus;

beforeEach(() => {
    bus = new EventBus();
});

describe('subscribe', () => {
    it('given handler subscribed, when event emitted, then handler receives event', () => {
        const received: GameEvent[] = [];
        bus.subscribe((e) => received.push(e));
        const event: GameEvent = { type: 'BULLET_REMOVED', bulletId: 1 };
        bus.emit(event);
        expect(received).toHaveLength(1);
        expect(received[0]).toBe(event);
    });

    it('given unsubscribe called, when event emitted, then handler does NOT receive event', () => {
        const received: GameEvent[] = [];
        const unsub = bus.subscribe((e) => received.push(e));
        unsub();
        bus.emit({ type: 'BULLET_REMOVED', bulletId: 1 });
        expect(received).toHaveLength(0);
    });

    it('given multiple handlers, when event emitted, then all handlers receive it', () => {
        const received1: GameEvent[] = [];
        const received2: GameEvent[] = [];
        bus.subscribe((e) => received1.push(e));
        bus.subscribe((e) => received2.push(e));
        bus.emit({ type: 'BULLET_REMOVED', bulletId: 1 });
        expect(received1).toHaveLength(1);
        expect(received2).toHaveLength(1);
    });
});

describe('emit', () => {
    it('given no handlers, when emitting, then does not throw', () => {
        expect(() => bus.emit({ type: 'BULLET_REMOVED', bulletId: 1 })).not.toThrow();
    });

    it('given handler, when emitting, then handler called with exact event object', () => {
        const handler = vi.fn();
        bus.subscribe(handler);
        const event: GameEvent = { type: 'PLAYER_KILLED', targetId: 1, killerId: 2 };
        bus.emit(event);
        expect(handler).toHaveBeenCalledWith(event);
    });
});

describe('emitAll', () => {
    it('given array of events, when emitting all, then each handler receives all events in order', () => {
        const received: GameEvent[] = [];
        bus.subscribe((e) => received.push(e));
        const events: GameEvent[] = [
            { type: 'BULLET_SPAWN', bulletId: 1, ownerId: 1, x: 0, y: 0, dx: 1, dy: 0, speed: 10 },
            { type: 'BULLET_REMOVED', bulletId: 1 },
        ];
        bus.emitAll(events);
        expect(received).toHaveLength(2);
        expect(received[0].type).toBe('BULLET_SPAWN');
        expect(received[1].type).toBe('BULLET_REMOVED');
    });

    it('given empty array, when emitting all, then no handlers called', () => {
        const handler = vi.fn();
        bus.subscribe(handler);
        bus.emitAll([]);
        expect(handler).not.toHaveBeenCalled();
    });
});
