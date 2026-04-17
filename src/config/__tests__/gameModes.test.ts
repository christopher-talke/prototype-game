import { describe, it, expect, beforeEach } from 'vitest';
import { GAME_MODES, GAME_MODES_MAP } from '@config/modes';
import { setGameMode, resetConfig, getConfig } from '@config/activeConfig';
import { BASE_DEFAULTS } from '@config/defaults';

beforeEach(() => {
    resetConfig();
});

describe('GAME_MODES structure', () => {
    it('given GAME_MODES, then all modes have unique id, non-empty name, description, and tags', () => {
        const ids = new Set<string>();
        for (const mode of GAME_MODES) {
            expect(mode.id).toBeTruthy();
            expect(mode.name).toBeTruthy();
            expect(mode.description).toBeTruthy();
            expect(mode.tags.length).toBeGreaterThan(0);
            expect(ids.has(mode.id)).toBe(false);
            ids.add(mode.id);
        }
    });

    it('given GAME_MODES, then every mode id exists in GAME_MODES_MAP', () => {
        for (const mode of GAME_MODES) {
            expect(GAME_MODES_MAP.has(mode.id)).toBe(true);
            expect(GAME_MODES_MAP.get(mode.id)).toBe(mode);
        }
    });
});

describe('mode partials merge cleanly', () => {
    it.each(GAME_MODES.map(m => [m.id, m.partial]))(
        'given %s mode, when applied, then getConfig has all required top-level keys',
        (_id, partial) => {
            setGameMode(partial);
            const config = getConfig();
            expect(config.match).toBeDefined();
            expect(config.economy).toBeDefined();
            expect(config.player).toBeDefined();
            expect(config.physics).toBeDefined();
            expect(config.weapons).toBeDefined();
            expect(config.grenades).toBeDefined();
            expect(config.ai).toBeDefined();
            expect(config.shooting).toBeDefined();
        },
    );

    it('given snipers-only mode, when applied, then weapons restricted and economy zeroed', () => {
        const mode = GAME_MODES_MAP.get('snipers-only')!;
        setGameMode(mode.partial);
        expect(getConfig().weapons.allowedWeapons).toEqual(['SNIPER']);
        expect(getConfig().weapons.startingWeapons).toEqual(['SNIPER']);
        expect(getConfig().economy.startingMoney).toBe(0);
    });

    it('given one-shot-kill mode, when applied, then maxHealth is 1 and damage multiplier is 100', () => {
        const mode = GAME_MODES_MAP.get('one-shot-kill')!;
        setGameMode(mode.partial);
        expect(getConfig().player.maxHealth).toBe(1);
        expect(getConfig().weapons.globalDamageMultiplier).toBe(100);
    });

    it('given chaos mode, when applied, then maxPlayers is 64', () => {
        const mode = GAME_MODES_MAP.get('chaos')!;
        setGameMode(mode.partial);
        expect(getConfig().match.maxPlayers).toBe(64);
    });

    it('given low-gravity mode, when applied, then speed is 9 and bulletSpeedMultiplier is 1.3', () => {
        const mode = GAME_MODES_MAP.get('low-gravity')!;
        setGameMode(mode.partial);
        expect(getConfig().player.speed).toBe(9);
        expect(getConfig().physics.bulletSpeedMultiplier).toBe(1.3);
    });
});

describe('mode round-trip', () => {
    it('given mode applied then resetConfig, when getConfig called, then equals BASE_DEFAULTS', () => {
        const mode = GAME_MODES_MAP.get('chaos')!;
        setGameMode(mode.partial);
        resetConfig();
        expect(getConfig()).toEqual(BASE_DEFAULTS);
    });
});
