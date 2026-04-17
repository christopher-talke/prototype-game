import { describe, it, expect, vi } from 'vitest';

vi.mock('..', () => ({
    loadSound: vi.fn(),
}));

import { getWeaponSoundId, getWeaponReloadSoundId } from '@audio/soundMap';

describe('getWeaponSoundId', () => {
    it('given PISTOL, then returns shoot_PISTOL', () => {
        expect(getWeaponSoundId('PISTOL')).toBe('shoot_PISTOL');
    });

    it('given SNIPER, then returns shoot_SNIPER', () => {
        expect(getWeaponSoundId('SNIPER')).toBe('shoot_SNIPER');
    });
});

describe('getWeaponReloadSoundId', () => {
    it('given RIFLE, then returns reload_RIFLE', () => {
        expect(getWeaponReloadSoundId('RIFLE')).toBe('reload_RIFLE');
    });

    it('given SHOTGUN, then returns reload_SHOTGUN', () => {
        expect(getWeaponReloadSoundId('SHOTGUN')).toBe('reload_SHOTGUN');
    });
});
