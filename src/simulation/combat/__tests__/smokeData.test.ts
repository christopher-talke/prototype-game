import { describe, it, expect, beforeEach } from 'vitest';
import { addSmokeData, removeExpiredSmoke, isSmoked, clearAllSmokeData } from '@simulation/combat/smokeData';

beforeEach(() => {
    clearAllSmokeData();
});

describe('addSmokeData + isSmoked', () => {
    it('given smoke added, when line passes through cloud center, then isSmoked returns true', () => {
        addSmokeData(100, 100, 50, 10000, 0);
        expect(isSmoked(0, 100, 200, 100)).toBe(true);
    });
});

describe('removeExpiredSmoke', () => {
    it('given smoke with expiresAt=10000, when timestamp >= expiresAt, then removes it', () => {
        addSmokeData(100, 100, 50, 5000, 0); // expiresAt = 5000
        removeExpiredSmoke(5000);
        expect(isSmoked(0, 100, 200, 100)).toBe(false);
    });

    it('given smoke with expiresAt=10000, when timestamp < expiresAt, then keeps it', () => {
        addSmokeData(100, 100, 50, 10000, 0); // expiresAt = 10000
        removeExpiredSmoke(5000);
        expect(isSmoked(0, 100, 200, 100)).toBe(true);
    });

    it('given mixed expired and active smoke, when removing, then only removes expired', () => {
        addSmokeData(100, 100, 50, 3000, 0);  // expiresAt = 3000
        addSmokeData(300, 300, 50, 8000, 0);  // expiresAt = 8000
        removeExpiredSmoke(5000);
        expect(isSmoked(0, 100, 200, 100)).toBe(false); // first smoke gone
        expect(isSmoked(250, 300, 350, 300)).toBe(true); // second smoke still active
    });
});

describe('isSmoked', () => {
    it('given no smoke, when checking any line, then returns false', () => {
        expect(isSmoked(0, 0, 100, 100)).toBe(false);
    });

    it('given smoke at (100,100) r=50, when line passes through center, then returns true', () => {
        addSmokeData(100, 100, 50, 10000, 0);
        expect(isSmoked(50, 100, 150, 100)).toBe(true);
    });

    it('given smoke at (100,100) r=50, when line is entirely outside radius, then returns false', () => {
        addSmokeData(100, 100, 50, 10000, 0);
        expect(isSmoked(200, 200, 300, 300)).toBe(false);
    });

    it('given smoke at (100,100) r=50, when line starts inside cloud, then returns true', () => {
        addSmokeData(100, 100, 50, 10000, 0);
        expect(isSmoked(100, 100, 300, 300)).toBe(true);
    });

    it('given multiple smoke clouds, when line intersects second cloud only, then returns true', () => {
        addSmokeData(100, 100, 30, 10000, 0); // far from the line
        addSmokeData(500, 500, 50, 10000, 0); // on the line
        expect(isSmoked(450, 500, 550, 500)).toBe(true);
    });
});
