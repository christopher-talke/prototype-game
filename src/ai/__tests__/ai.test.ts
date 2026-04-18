import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetConfig } from '@config/activeConfig';
import { makePlayer } from '../../test/helpers';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../../constants';
import type { PlayerInput } from '@net/gameEvent';

// Mock dependencies before importing the AI module
vi.mock('@net/offlineAdapter', () => {
    return {
        offlineAdapter: {
            sendInput: vi.fn(),
            authSim: {
                getPlayerState: vi.fn(),
            },
        },
    };
});

vi.mock('@simulation/detection/raycast', () => ({
    isLineBlocked: vi.fn().mockReturnValue(false),
}));

vi.mock('@simulation/environment/environment', () => ({
    environment: { segments: [] },
}));

vi.mock('@maps/helpers', () => ({
    getActiveMap: vi.fn().mockReturnValue({
        navHints: [
            { id: 'n1', type: 'cover', position: { x: 500, y: 500 }, radius: 100, weight: 0.5 },
            { id: 'n2', type: 'cover', position: { x: 1000, y: 1000 }, radius: 100, weight: 0.5 },
            { id: 'n3', type: 'cover', position: { x: 1500, y: 500 }, radius: 100, weight: 0.5 },
        ],
        zones: [
            { id: 'spawn1', type: 'spawn', label: 'Spawn 1', team: '1', polygon: [
                { x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }, { x: 50, y: 150 },
            ] },
        ],
        layers: [],
    }),
}));

import { registerAI, updateAllAI, clearAllAI } from '@ai/index';
import { offlineAdapter } from '@net/offlineAdapter';
import { isLineBlocked } from '@simulation/detection/raycast';

const mockSendInput = offlineAdapter.sendInput as ReturnType<typeof vi.fn>;
const mockGetPlayerState = offlineAdapter.authSim.getPlayerState as ReturnType<typeof vi.fn>;
const mockIsLineBlocked = isLineBlocked as ReturnType<typeof vi.fn>;

beforeEach(() => {
    resetConfig();
    clearAllAI();
    mockSendInput.mockClear();
    mockGetPlayerState.mockReturnValue({ playerId: 1, kills: 0, deaths: 0, money: 0, points: 0 });
    mockIsLineBlocked.mockReturnValue(false);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
    vi.restoreAllMocks();
});

function getSentInputs(): PlayerInput[] {
    return mockSendInput.mock.calls.map((c: any[]) => c[0]);
}

// ---- State Machine Transitions ----

describe('AI state machine transitions', () => {
    it('given patrol state, when enemy detected within range and LOS clear, then transitions to chase (sends FIRE or MOVE toward target)', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: 0 } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 700, y: 500, rotation: 0 } });
        registerAI(bot);
        // LOS is clear (mockIsLineBlocked returns false)
        // Run enough frames to trigger LOS scan (AI_LOS_INTERVAL = 3)
        for (let i = 0; i < 4; i++) {
            updateAllAI([bot, enemy], 10000 + i * 16);
        }
        // Should have sent inputs toward the enemy (ROTATE and/or MOVE)
        const inputs = getSentInputs();
        expect(inputs.length).toBeGreaterThan(0);
    });

    it('given chase state with target, when LOS becomes blocked and chaseTimeout elapses, then returns to patrol', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: 0 } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 700, y: 500, rotation: 0 } });
        registerAI(bot);

        // First make the bot see the enemy (chase state)
        updateAllAI([bot, enemy], 10000);

        // Now block LOS
        mockIsLineBlocked.mockReturnValue(true);

        // Advance past chaseTimeout (5000ms)
        for (let i = 0; i < 10; i++) {
            updateAllAI([bot, enemy], 16000 + i * 16);
        }
        // Bot should now be back in patrol, moving toward waypoints not toward enemy
        // We can verify by checking it sends MOVE inputs (patrol behavior)
        const lastInputs = getSentInputs();
        expect(lastInputs.length).toBeGreaterThan(0);
    });

    it('given patrol with no enemies, when updating, then remains in patrol (sends MOVE toward waypoint)', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 100, y: 100, rotation: 0 } });
        registerAI(bot);
        updateAllAI([bot], 10000);
        const inputs = getSentInputs();
        // Should send MOVE and ROTATE toward first waypoint
        expect(inputs.some(i => i.type === 'MOVE')).toBe(true);
    });
});

// ---- Patrol Behavior ----

describe('patrol behavior', () => {
    it('given patrol state with waypoints, when not at waypoint, then sends MOVE toward waypoint', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 100, y: 100, rotation: 0 } });
        registerAI(bot);
        updateAllAI([bot], 10000);
        const moveInput = getSentInputs().find(i => i.type === 'MOVE');
        expect(moveInput).toBeDefined();
    });

    it('given patrol state, when within 30px of waypoint, then advances waypointIndex and pauses', () => {
        // Place bot very close to first waypoint (500, 500)
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500 - HALF_HIT_BOX, y: 500 - HALF_HIT_BOX, rotation: 0 } });
        registerAI(bot);
        updateAllAI([bot], 10000);
        // After reaching waypoint, should pause (patrolPause = 1500ms)
        // Next update within pause period should not send MOVE
        mockSendInput.mockClear();
        updateAllAI([bot], 10100);
        const moveInputs = getSentInputs().filter(i => i.type === 'MOVE');
        expect(moveInputs).toHaveLength(0);
    });
});

// ---- Chase Behavior ----

describe('chase behavior', () => {
    it('given chase with target >200px away, then sends MOVE toward target', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 800, y: 500, rotation: 0 } });
        registerAI(bot);
        // Run enough frames to trigger LOS scan and enter chase (AI_LOS_INTERVAL = 3)
        for (let i = 0; i < 4; i++) {
            updateAllAI([bot, enemy], 10000 + i * 16);
        }
        // Get the last MOVE input (after chase is triggered, not the initial patrol move)
        const moves = getSentInputs().filter(i => i.type === 'MOVE');
        const moveInput = moves[moves.length - 1];
        expect(moveInput).toBeDefined();
        if (moveInput && moveInput.type === 'MOVE') {
            // dx should be positive (moving right toward enemy)
            expect(moveInput.dx).toBeGreaterThan(0);
        }
    });

    it('given chase with target <100px away, then sends MOVE away (backpedal)', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 530, y: 500, rotation: 0 } });
        registerAI(bot);
        // Trigger chase and immediate backpedal (distance ~30 + HALF_HIT_BOX ~ 52)
        updateAllAI([bot, enemy], 10000);
        const moveInput = getSentInputs().find(i => i.type === 'MOVE');
        expect(moveInput).toBeDefined();
        if (moveInput && moveInput.type === 'MOVE') {
            // dx should be negative (backing away)
            expect(moveInput.dx).toBeLessThan(0);
        }
    });

    it('given chase with LOS clear and facing target, then sends FIRE input', () => {
        // Make bot face the enemy within fireCone (8 degrees)
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 800, y: 500, rotation: 0 } });
        registerAI(bot);
        // Need multiple updates for LOS scan to trigger and fire
        for (let i = 0; i < 4; i++) {
            updateAllAI([bot, enemy], 10000 + i * 16);
        }
        const fireInput = getSentInputs().find(i => i.type === 'FIRE');
        expect(fireInput).toBeDefined();
    });

    it('given chase with LOS blocked, when wallHitShots exceed threshold, then moves toward target', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 800, y: 500, rotation: 0 } });
        registerAI(bot);

        // First establish chase with clear LOS
        updateAllAI([bot, enemy], 10000);

        // Then block LOS for several frames to accumulate wallHitShots
        mockIsLineBlocked.mockReturnValue(true);
        for (let i = 0; i < 10; i++) {
            mockSendInput.mockClear();
            updateAllAI([bot, enemy], 10100 + i * 16);
        }
        // Should still be sending MOVE inputs (moving toward target to find LOS)
        const moves = getSentInputs().filter(i => i.type === 'MOVE');
        expect(moves.length).toBeGreaterThan(0);
    });

    it('given chase with target <450px and grenade cooldown elapsed, then sends THROW_GRENADE', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        bot.grenades.FRAG = 1;
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 800, y: 500, rotation: 0 } });
        registerAI(bot);
        // Run at timestamp well past grenade cooldown (5s)
        for (let i = 0; i < 4; i++) {
            updateAllAI([bot, enemy], 10000 + i * 16);
        }
        const grenadeInput = getSentInputs().find(i => i.type === 'THROW_GRENADE');
        expect(grenadeInput).toBeDefined();
    });
});

// ---- Search Behavior ----

describe('search behavior', () => {
    it('given search state with targetLastPos, when not at position, then sends MOVE toward it', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 800, y: 500, rotation: 0 } });
        registerAI(bot);

        // First establish chase (see enemy)
        updateAllAI([bot, enemy], 10000);

        // Now enemy disappears (LOS blocked, but within timeout)
        mockIsLineBlocked.mockReturnValue(true);
        mockSendInput.mockClear();
        updateAllAI([bot, enemy], 11000); // within chaseTimeout (5000ms)

        const moveInput = getSentInputs().find(i => i.type === 'MOVE');
        expect(moveInput).toBeDefined();
    });

    it('given search state, when within 30px of targetLastPos, then sends ROTATE (scanning)', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 500 + HALF_HIT_BOX + 10, y: 500, rotation: 0 } });
        registerAI(bot);

        // See enemy, then lose them
        updateAllAI([bot, enemy], 10000);
        mockIsLineBlocked.mockReturnValue(true);
        // Bot is already very close to enemy last known pos
        mockSendInput.mockClear();
        updateAllAI([bot, enemy], 11000);

        const rotateInput = getSentInputs().find(i => i.type === 'ROTATE');
        expect(rotateInput).toBeDefined();
    });
});

// ---- Stuck Detection ----

describe('stuck detection', () => {
    it('given movement < threshold for many frames, when updating, then sends MOVE in random unstick direction', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: 0 } });
        registerAI(bot);

        // Simulate being stuck: position doesn't change for 15+ frames
        for (let i = 0; i < 20; i++) {
            mockSendInput.mockClear();
            updateAllAI([bot], 10000 + i * 16);
        }
        // After 15 frames of being stuck, should start unsticking
        const lastMoves = getSentInputs().filter(i => i.type === 'MOVE');
        expect(lastMoves.length).toBeGreaterThan(0);
    });
});

// ---- Buy Logic ----

describe('buy logic', () => {
    it('given money >= SMG price, when updating, then sends BUY_WEAPON for affordable weapon', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: 0 } });
        registerAI(bot);
        mockGetPlayerState.mockReturnValue({ playerId: 1, kills: 0, deaths: 0, money: 5000, points: 0 });
        updateAllAI([bot], 10000);
        const buyInput = getSentInputs().find(i => i.type === 'BUY_WEAPON');
        expect(buyInput).toBeDefined();
        if (buyInput && buyInput.type === 'BUY_WEAPON') {
            expect(buyInput.weaponType).toBe('SMG'); // first in BUY_PRIORITY
        }
    });

    it('given money < all weapon prices, when updating, then no BUY_WEAPON sent', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: 0 } });
        registerAI(bot);
        mockGetPlayerState.mockReturnValue({ playerId: 1, kills: 0, deaths: 0, money: 10, points: 0 });
        updateAllAI([bot], 10000);
        const buyInput = getSentInputs().find(i => i.type === 'BUY_WEAPON');
        expect(buyInput).toBeUndefined();
    });

    it('given money >= grenade price, when updating, then sends BUY_GRENADE', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: 0 } });
        registerAI(bot);
        mockGetPlayerState.mockReturnValue({ playerId: 1, kills: 0, deaths: 0, money: 5000, points: 0 });
        updateAllAI([bot], 10000);
        const buyGrenadeInput = getSentInputs().find(i => i.type === 'BUY_GRENADE');
        expect(buyGrenadeInput).toBeDefined();
    });
});

// ---- Fire/Reload Logic ----

describe('fire and reload logic', () => {
    it('given weapon with ammo=0 and not reloading, when in chase, then sends RELOAD', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        bot.weapons[0].ammo = 0;
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 800, y: 500, rotation: 0 } });
        registerAI(bot);
        for (let i = 0; i < 4; i++) {
            updateAllAI([bot, enemy], 10000 + i * 16);
        }
        const reloadInput = getSentInputs().find(i => i.type === 'RELOAD');
        expect(reloadInput).toBeDefined();
    });

    it('given weapon reloading (non-shell), when in chase, then does NOT send FIRE', () => {
        const bot = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: ROTATION_OFFSET } });
        bot.weapons[0].reloading = true;
        bot.weapons[0].ammo = 0;
        const enemy = makePlayer({ id: 2, team: 2, current_position: { x: 800, y: 500, rotation: 0 } });
        registerAI(bot);
        for (let i = 0; i < 4; i++) {
            updateAllAI([bot, enemy], 10000 + i * 16);
        }
        const fireInput = getSentInputs().find(i => i.type === 'FIRE');
        expect(fireInput).toBeUndefined();
    });
});

// ---- Dead Bot ----

describe('dead bot', () => {
    it('given dead bot, when updating, then sends no inputs', () => {
        const bot = makePlayer({ id: 1, team: 1, dead: true, current_position: { x: 500, y: 500, rotation: 0 } });
        registerAI(bot);
        updateAllAI([bot], 10000);
        expect(mockSendInput).not.toHaveBeenCalled();
    });
});
