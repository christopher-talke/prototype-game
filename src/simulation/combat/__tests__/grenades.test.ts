import { describe, it, expect, beforeEach } from 'vitest';
import { getGrenadeDef, isGrenadeAllowed, createDefaultGrenades } from '@simulation/combat/grenades';
import { setGameMode, resetConfig } from '@config/activeConfig';

beforeEach(() => {
    resetConfig();
});

describe('getGrenadeDef', () => {
    it('given FRAG type, when getting def, then returns correct values', () => {
        const def = getGrenadeDef('FRAG');
        expect(def.damage).toBe(100);
        expect(def.fuseTime).toBe(2000);
        expect(def.radius).toBe(150);
        expect(def.shrapnelCount).toBe(30);
    });

    it('given C4 type, when getting def, then has zero fuse and throwSpeed', () => {
        const def = getGrenadeDef('C4');
        expect(def.fuseTime).toBe(0);
        expect(def.throwSpeed).toBe(0);
        expect(def.damage).toBe(150);
        expect(def.shrapnelCount).toBe(80);
    });

    it('given FLASH type, when getting def, then has zero damage and effectDuration', () => {
        const def = getGrenadeDef('FLASH');
        expect(def.damage).toBe(0);
        expect(def.effectDuration).toBe(3000);
        expect(def.radius).toBe(600);
    });

    it('given SMOKE type, when getting def, then has zero damage and long effectDuration', () => {
        const def = getGrenadeDef('SMOKE');
        expect(def.damage).toBe(0);
        expect(def.effectDuration).toBe(22000);
        expect(def.radius).toBe(120);
    });
});

describe('isGrenadeAllowed', () => {
    it('given allowedGrenades is ALL, when checking any type, then returns true', () => {
        expect(isGrenadeAllowed('FRAG')).toBe(true);
        expect(isGrenadeAllowed('C4')).toBe(true);
    });

    it('given specific allowed list, when type is in list, then returns true', () => {
        setGameMode({ grenades: { allowedGrenades: ['FRAG', 'SMOKE'] } });
        expect(isGrenadeAllowed('FRAG')).toBe(true);
    });

    it('given specific allowed list, when type is NOT in list, then returns false', () => {
        setGameMode({ grenades: { allowedGrenades: ['FRAG', 'SMOKE'] } });
        expect(isGrenadeAllowed('FLASH')).toBe(false);
    });
});

describe('createDefaultGrenades', () => {
    it('given empty startingGrenades config, when creating defaults, then all counts are zero', () => {
        const grenades = createDefaultGrenades();
        expect(grenades.FRAG).toBe(0);
        expect(grenades.FLASH).toBe(0);
        expect(grenades.SMOKE).toBe(0);
        expect(grenades.C4).toBe(0);
    });

    it('given startingGrenades with FRAG:2, when creating defaults, then FRAG is 2', () => {
        setGameMode({ grenades: { startingGrenades: { FRAG: 2 } } });
        const grenades = createDefaultGrenades();
        expect(grenades.FRAG).toBe(2);
        expect(grenades.FLASH).toBe(0);
    });
});
