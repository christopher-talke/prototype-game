import { describe, it, expect, vi } from 'vitest';
import { SignalBus } from '@orchestration/signals/signalBus';

const signals = [
    { id: 'generator.offline', label: 'Generator Offline' },
    { id: 'door.unlock', label: 'Door Unlock' },
];

describe('SignalBus registration', () => {
    it('delivers a declared emit to every registered handler', () => {
        const bus = new SignalBus(signals);
        const h1 = vi.fn();
        const h2 = vi.fn();
        bus.on('generator.offline', h1);
        bus.on('generator.offline', h2);
        bus.emit('generator.offline', { playerId: 7 });
        expect(h1).toHaveBeenCalledWith({ playerId: 7 });
        expect(h2).toHaveBeenCalledWith({ playerId: 7 });
    });

    it('does not cross-deliver between distinct signals', () => {
        const bus = new SignalBus(signals);
        const hGen = vi.fn();
        const hDoor = vi.fn();
        bus.on('generator.offline', hGen);
        bus.on('door.unlock', hDoor);
        bus.emit('door.unlock', { playerId: null });
        expect(hGen).not.toHaveBeenCalled();
        expect(hDoor).toHaveBeenCalledTimes(1);
    });

    it('no-ops when a declared signal has no listeners', () => {
        const bus = new SignalBus(signals);
        expect(() => bus.emit('generator.offline', { playerId: null })).not.toThrow();
    });

    it('throws when registering a handler for an unknown signal', () => {
        const bus = new SignalBus(signals);
        expect(() => bus.on('mystery', () => {})).toThrow(/unknown signal 'mystery'/);
    });

    it('throws when emitting an unknown signal', () => {
        const bus = new SignalBus(signals);
        expect(() => bus.emit('mystery', { playerId: null })).toThrow(/unknown signal 'mystery'/);
    });
});

describe('SignalBus lifecycle', () => {
    it('clear drops all listeners so subsequent emits are silent', () => {
        const bus = new SignalBus(signals);
        const h = vi.fn();
        bus.on('generator.offline', h);
        bus.clear();
        bus.emit('generator.offline', { playerId: null });
        expect(h).not.toHaveBeenCalled();
    });

    it('returned unsubscribe removes only that handler', () => {
        const bus = new SignalBus(signals);
        const h1 = vi.fn();
        const h2 = vi.fn();
        const off = bus.on('generator.offline', h1);
        bus.on('generator.offline', h2);
        off();
        bus.emit('generator.offline', { playerId: null });
        expect(h1).not.toHaveBeenCalled();
        expect(h2).toHaveBeenCalledTimes(1);
    });
});
