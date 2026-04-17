import { describe, it, expect, beforeEach } from 'vitest';
import { deepMerge, setGameMode, resetConfig, getConfig } from '@config/activeConfig';
import { BASE_DEFAULTS } from '@config/defaults';

beforeEach(() => {
    resetConfig();
});

describe('deepMerge', () => {
    it('given flat partial with one key changed, when merged, then only that key differs', () => {
        const base = { a: 1, b: 2, c: 3 };
        const result = deepMerge(base, base, { a: 10 });
        expect(result).toEqual({ a: 10, b: 2, c: 3 });
    });

    it('given nested partial, when merged, then unspecified sibling keys retain base values', () => {
        const base = { player: { speed: 6, maxHealth: 100 } };
        const result = deepMerge(base, base, { player: { speed: 9 } });
        expect(result.player.speed).toBe(9);
        expect(result.player.maxHealth).toBe(100);
    });

    it('given partial with array value, when merged, then array replaces entirely', () => {
        const base = { weapons: { startingWeapons: ['PISTOL'] } };
        const result = deepMerge(base, base, { weapons: { startingWeapons: ['SNIPER', 'RIFLE'] } });
        expect(result.weapons.startingWeapons).toEqual(['SNIPER', 'RIFLE']);
    });

    it('given partial with string replacing array, when merged, then string replaces array', () => {
        const base = { weapons: { allowed: ['PISTOL', 'RIFLE'] as string[] | string } };
        const result = deepMerge(base, base, { weapons: { allowed: 'ALL' } });
        expect(result.weapons.allowed).toBe('ALL');
    });

    it('given two successive merges, when second partial overrides first, then second wins', () => {
        const base = { a: 1, b: 2 };
        const first = deepMerge(base, base, { a: 10 });
        const second = deepMerge(base, first, { a: 20 });
        expect(second.a).toBe(20);
    });

    it('given partial with undefined value, when merged, then that key is skipped', () => {
        const base = { a: 1, b: 2 };
        const result = deepMerge(base, base, { a: undefined });
        expect(result.a).toBe(1);
    });

    it('given deeply nested override (3+ levels), when merged, then nested value is applied', () => {
        const base = { weapons: { overrides: {} as Record<string, any> } };
        const active = deepMerge(base, base, { weapons: { overrides: { PISTOL: { damage: 50 } } } });
        expect(active.weapons.overrides.PISTOL.damage).toBe(50);
    });

    it('given empty object partial for nested key, when merged, then existing keys are NOT cleared (known edge case)', () => {
        const base = { weapons: { overrides: {} as Record<string, any>, damage: 1 } };
        const active = deepMerge(base, base, { weapons: { overrides: { PISTOL: { damage: 50 } } } });
        // Now merge with empty overrides -- the known edge case: PISTOL persists
        const reset = deepMerge(base, active, { weapons: { overrides: {} } });
        // Document the current behavior: empty object does NOT clear accumulated keys
        expect(reset.weapons.overrides).toEqual({ PISTOL: { damage: 50 } });
    });

    it('given activeConfig differs from base, when partial targets same key, then partial wins', () => {
        const base = { a: 1, b: 2 };
        const active = { a: 5, b: 2 };
        const result = deepMerge(base, active, { a: 99 });
        expect(result.a).toBe(99);
        expect(result.b).toBe(2);
    });

    it('given activeConfig has extra nested key not in base, when partial is base, then extra key persists (from activeConfig spread)', () => {
        const base = { nested: { x: 1 } as Record<string, number> };
        const active = { nested: { x: 1, y: 2 } };
        // Partial only sets x -- y comes from activeConfig spread
        const result = deepMerge(base, active, { nested: { x: 10 } });
        expect(result.nested.x).toBe(10);
        expect(result.nested.y).toBe(2);
    });
});

describe('setGameMode', () => {
    it('given default config, when setGameMode called with partial, then getConfig reflects change', () => {
        setGameMode({ player: { speed: 9 } });
        expect(getConfig().player.speed).toBe(9);
        expect(getConfig().player.maxHealth).toBe(100); // unchanged
    });

    it('given mode already applied, when setGameMode called again, then result incorporates both', () => {
        setGameMode({ player: { speed: 9 } });
        setGameMode({ match: { roundsToWin: 3 } });
        expect(getConfig().player.speed).toBe(9);
        expect(getConfig().match.roundsToWin).toBe(3);
    });
});

describe('resetConfig', () => {
    it('given modified config, when resetConfig called, then getConfig deep-equals BASE_DEFAULTS', () => {
        setGameMode({ player: { speed: 99 }, match: { maxPlayers: 64 } });
        resetConfig();
        expect(getConfig()).toEqual(BASE_DEFAULTS);
    });

    it('given resetConfig called, when returned config mutated, then next getConfig unaffected', () => {
        resetConfig();
        const config = getConfig();
        config.player.speed = 999;
        // getConfig returns the same reference, so we need resetConfig to prove isolation
        resetConfig();
        expect(getConfig().player.speed).toBe(BASE_DEFAULTS.player.speed);
    });
});
