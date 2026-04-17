import { describe, it, expect } from 'vitest';
import type { ObjectDefinition } from '@shared/map/MapData';
import { ObjectDefRegistry } from '@orchestration/bootstrap/objectDefRegistry';

function def(id: string, label = id): ObjectDefinition {
    return {
        id,
        label,
        collisionShape: null,
        lights: [],
        sprites: [],
        pivot: { x: 0, y: 0 },
    };
}

describe('ObjectDefRegistry three-tier resolution', () => {
    it('resolves a local def when only local is present', () => {
        const reg = new ObjectDefRegistry([def('crate')], []);
        expect(reg.resolve('crate').id).toBe('crate');
    });

    it('resolves a shared def when local is absent', () => {
        const reg = new ObjectDefRegistry([], [def('barrel', 'Shared Barrel')]);
        expect(reg.resolve('barrel').label).toBe('Shared Barrel');
    });

    it('prefers local over shared when both define the same id', () => {
        const reg = new ObjectDefRegistry(
            [def('crate', 'Local Crate')],
            [def('crate', 'Shared Crate')],
        );
        expect(reg.resolve('crate').label).toBe('Local Crate');
    });

    it('throws with both tiers listed when id is unresolved', () => {
        const reg = new ObjectDefRegistry([], []);
        expect(() => reg.resolve('missing')).toThrow(/unresolved objectDefId "missing".+local, shared/);
    });

    it('has() returns true for either tier', () => {
        const reg = new ObjectDefRegistry([def('a')], [def('b')]);
        expect(reg.has('a')).toBe(true);
        expect(reg.has('b')).toBe(true);
        expect(reg.has('c')).toBe(false);
    });
});
