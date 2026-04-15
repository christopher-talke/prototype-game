import { describe, it, expect, beforeEach } from 'vitest';
import { getWeaponDef, isWeaponAllowed, createDefaultWeapon, WEAPON_DEFS } from '@simulation/combat/weapons';
import { setGameMode, resetConfig } from '@config/activeConfig';

beforeEach(() => {
    resetConfig();
});

describe('getWeaponDef', () => {
    it('given no config overrides, when getting PISTOL, then returns base def', () => {
        const def = getWeaponDef('PISTOL');
        expect(def.id).toBe('PISTOL');
        expect(def.damage).toBe(26);
        expect(def.fireRate).toBe(250);
        expect(def.magSize).toBe(12);
    });

    it('given no config overrides, when getting RIFLE, then returns correct values', () => {
        const def = getWeaponDef('RIFLE');
        expect(def.id).toBe('RIFLE');
        expect(def.damage).toBe(35);
        expect(def.bulletSpeed).toBe(22);
    });

    it('given unknown weapon type, when getting def, then falls back to PISTOL', () => {
        const def = getWeaponDef('NONEXISTENT');
        expect(def.id).toBe('PISTOL');
    });

    it('given globalDamageMultiplier of 2.0, when getting PISTOL, then damage is doubled and rounded', () => {
        setGameMode({ weapons: { globalDamageMultiplier: 2.0 } });
        const def = getWeaponDef('PISTOL');
        expect(def.damage).toBe(52); // 26 * 2.0
    });

    it('given bulletSpeedMultiplier of 1.5, when getting PISTOL, then bulletSpeed is scaled and rounded', () => {
        setGameMode({ physics: { bulletSpeedMultiplier: 1.5 } });
        const def = getWeaponDef('PISTOL');
        expect(def.bulletSpeed).toBe(27); // 18 * 1.5 = 27
    });

    it('given recoilMultiplier of 2.0, when getting PISTOL, then recoil pattern is scaled', () => {
        setGameMode({ weapons: { recoilMultiplier: 2.0 } });
        const def = getWeaponDef('PISTOL');
        const basePattern = WEAPON_DEFS.PISTOL.recoilPattern;
        expect(def.recoilPattern[1].y).toBeCloseTo(basePattern[1].y * 2.0, 5);
    });

    it('given per-weapon override, when getting weapon, then override fields apply', () => {
        setGameMode({ weapons: { overrides: { PISTOL: { damage: 50 } } } });
        const def = getWeaponDef('PISTOL');
        expect(def.damage).toBe(50);
    });

    it('given per-weapon override AND globalDamageMultiplier, when getting weapon, then both apply', () => {
        setGameMode({
            weapons: {
                overrides: { PISTOL: { damage: 50 } },
                globalDamageMultiplier: 2.0,
            },
        });
        const def = getWeaponDef('PISTOL');
        expect(def.damage).toBe(100); // 50 * 2.0
    });
});

describe('isWeaponAllowed', () => {
    it('given allowedWeapons is ALL, when checking any weapon, then returns true', () => {
        expect(isWeaponAllowed('PISTOL')).toBe(true);
        expect(isWeaponAllowed('SNIPER')).toBe(true);
    });

    it('given specific allowed list, when weapon is in list, then returns true', () => {
        setGameMode({ weapons: { allowedWeapons: ['PISTOL', 'RIFLE'] } });
        expect(isWeaponAllowed('PISTOL')).toBe(true);
    });

    it('given specific allowed list, when weapon is NOT in list, then returns false', () => {
        setGameMode({ weapons: { allowedWeapons: ['PISTOL', 'RIFLE'] } });
        expect(isWeaponAllowed('SNIPER')).toBe(false);
    });
});

describe('createDefaultWeapon', () => {
    it('given default config, when creating default weapon, then returns PISTOL with full mag', () => {
        const weapon = createDefaultWeapon();
        expect(weapon.type).toBe('PISTOL');
        expect(weapon.ammo).toBe(WEAPON_DEFS.PISTOL.magSize);
        expect(weapon.maxAmmo).toBe(WEAPON_DEFS.PISTOL.magSize);
        expect(weapon.active).toBe(true);
        expect(weapon.reloading).toBe(false);
    });
});
