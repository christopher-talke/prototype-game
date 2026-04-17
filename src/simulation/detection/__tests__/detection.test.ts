import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectOtherPlayers } from '@simulation/detection/detection';
import { addPlayer, clearPlayerRegistry, setActivePlayer } from '@simulation/player/playerRegistry';
import { environment, setEnvironmentLimits, clearWallGeometry, makeSegment } from '@simulation/environment/environment';
import { clearAllSmokeData, addSmokeData } from '@simulation/combat/smokeData';
import { makePlayer } from '../../../test/helpers';

beforeEach(async () => {
    vi.resetModules();
    clearPlayerRegistry();
    clearWallGeometry();
    clearAllSmokeData();
    setEnvironmentLimits(3000, 3000);
});

describe('detectOtherPlayers', () => {
    it('given source player not in registry, when detecting, then returns count 0', () => {
        const result = detectOtherPlayers(999);
        expect(result.count).toBe(0);
    });

    it('given two players with clear LOS and within range, when detecting, then blocked is false', () => {
        const source = makePlayer({ id: 1, current_position: { x: 100, y: 100, rotation: 90 } });
        const target = makePlayer({ id: 2, team: 2, current_position: { x: 200, y: 100, rotation: 0 } });
        addPlayer(source);
        addPlayer(target);
        setActivePlayer(1);
        const result = detectOtherPlayers(1);
        expect(result.count).toBe(1);
        expect(result.entries[0].targetId).toBe(2);
        expect(result.entries[0].blocked).toBe(false);
    });

    it('given target beyond MAX_DETECT_DIST (1800px), when detecting, then blocked is true', () => {
        const source = makePlayer({ id: 1, current_position: { x: 100, y: 100, rotation: 90 } });
        const target = makePlayer({ id: 2, team: 2, current_position: { x: 2000, y: 100, rotation: 0 } });
        addPlayer(source);
        addPlayer(target);
        setActivePlayer(1);
        const result = detectOtherPlayers(1);
        expect(result.count).toBe(1);
        expect(result.entries[0].blocked).toBe(true);
    });

    it('given wall between players, when detecting, then blocked is true', () => {
        const source = makePlayer({ id: 1, current_position: { x: 100, y: 500, rotation: 90 } });
        const target = makePlayer({ id: 2, team: 2, current_position: { x: 400, y: 500, rotation: 0 } });
        addPlayer(source);
        addPlayer(target);
        setActivePlayer(1);
        // Add a wide wall between them
        environment.segments.push(makeSegment(250, 0, 250, 1000));
        const result = detectOtherPlayers(1);
        expect(result.count).toBe(1);
        expect(result.entries[0].blocked).toBe(true);
    });

    it('given smoke between players, when detecting, then blocked is true', () => {
        const source = makePlayer({ id: 1, current_position: { x: 100, y: 500, rotation: 90 } });
        const target = makePlayer({ id: 2, team: 2, current_position: { x: 400, y: 500, rotation: 0 } });
        addPlayer(source);
        addPlayer(target);
        setActivePlayer(1);
        addSmokeData(250, 500, 80, 30000, 0);
        const result = detectOtherPlayers(1);
        expect(result.count).toBe(1);
        expect(result.entries[0].blocked).toBe(true);
    });

    it('given only self in registry, when detecting, then count is 0', () => {
        const source = makePlayer({ id: 1 });
        addPlayer(source);
        setActivePlayer(1);
        const result = detectOtherPlayers(1);
        expect(result.count).toBe(0);
    });

    it('given same team players, when detecting, then sameTeam is true in result', () => {
        const source = makePlayer({ id: 1, team: 1, current_position: { x: 100, y: 100, rotation: 90 } });
        const target = makePlayer({ id: 2, team: 1, current_position: { x: 200, y: 100, rotation: 0 } });
        addPlayer(source);
        addPlayer(target);
        setActivePlayer(1);
        const result = detectOtherPlayers(1);
        expect(result.count).toBe(1);
        expect(result.entries[0].result.sameTeam).toBe(true);
    });
});
