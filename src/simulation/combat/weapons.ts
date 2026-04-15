/**
 * Weapon definitions (simulation data) and VFX configuration blocks.
 * Simulation data (WEAPON_DEFS) is consumed by GameSimulation and AuthoritativeSimulation.
 * VFX data (DEFAULT_WEAPON_VFX, WEAPON_VFX_OVERRIDES) is consumed by the rendering layer's
 * projectile renderer, wall impact effects, and grid displacement system.
 *
 * Simulation layer - does not depend on rendering, net, or orchestration.
 */

/** Base simulation parameters for all weapon types. */
export const WEAPON_DEFS: Record<string, WeaponDef> = {
    PISTOL: {
        id: 'PISTOL',
        name: 'Pistol',
        damage: 26,
        fireRate: 250,
        reloadTime: 1500,
        magSize: 12,
        bulletSpeed: 18,
        price: 0,
        killReward: 300,
        pellets: 1,
        spread: 1,
        cameraOffset: 80,
        recoilPattern: [
            { x: 0, y: 0 },
            { x: 0, y: 1.5 },
            { x: 0.3, y: 1.8 },
            { x: -0.3, y: 2.0 },
            { x: 0.5, y: 2.2 },
            { x: -0.4, y: 2.5 },
            { x: 0.3, y: 2.8 },
            { x: -0.5, y: 3.0 },
            { x: 0.4, y: 3.2 },
            { x: -0.3, y: 3.5 },
            { x: 0.5, y: 3.8 },
            { x: -0.4, y: 4.0 },
        ],
    },
    SMG: {
        id: 'SMG',
        name: 'SMG',
        damage: 20,
        fireRate: 80,
        reloadTime: 2000,
        magSize: 30,
        bulletSpeed: 20,
        price: 1200,
        killReward: 600,
        pellets: 1,
        spread: 2,
        cameraOffset: 100,
        recoilPattern: generateSMGPattern(),
    },
    RIFLE: {
        id: 'RIFLE',
        name: 'Rifle',
        damage: 35,
        fireRate: 100,
        reloadTime: 2500,
        magSize: 30,
        bulletSpeed: 22,
        price: 2700,
        killReward: 300,
        pellets: 1,
        spread: 1.5,
        cameraOffset: 150,
        recoilPattern: generateRiflePattern(),
    },
    SHOTGUN: {
        id: 'SHOTGUN',
        name: 'Shotgun',
        damage: 18,
        fireRate: 900,
        reloadTime: 3000,
        magSize: 8,
        bulletSpeed: 16,
        price: 1800,
        killReward: 900,
        pellets: 8,
        spread: 12,
        cameraOffset: 60,
        mechanicalSound: 'shotgun_pump',
        mechanicalDelay: 350,
        shellReloadTime: 500,
        recoilPattern: [
            { x: 0, y: 0 },
            { x: 0, y: 4 },
            { x: 0.5, y: 4.5 },
            { x: -0.5, y: 5 },
            { x: 0.3, y: 5.5 },
            { x: -0.3, y: 6 },
            { x: 0.4, y: 6 },
            { x: -0.4, y: 6.5 },
        ],
    },
    SNIPER: {
        id: 'SNIPER',
        name: 'Sniper',
        damage: 110,
        fireRate: 1500,
        reloadTime: 3500,
        magSize: 5,
        bulletSpeed: 90,
        price: 4750,
        killReward: 100,
        pellets: 1,
        spread: 0,
        cameraOffset: 250,
        mechanicalSound: 'sniper_bolt',
        mechanicalDelay: 500,
        recoilPattern: [
            { x: 0, y: 0 },
            { x: 0, y: 6 },
            { x: 0.5, y: 7 },
            { x: -0.5, y: 8 },
            { x: 0.3, y: 8.5 },
        ],
    },
};

/** Generates a 30-shot SMG recoil pattern with sinusoidal horizontal sway. */
function generateSMGPattern(): { x: number; y: number }[] {
    const pattern: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (let i = 1; i < 30; i++) {
        const y = Math.min(1.2 + i * 0.15, 3.5);
        const x = Math.sin(i * 0.4) * (0.5 + i * 0.05);
        pattern.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    return pattern;
}

/**
 * Generates a 30-shot rifle recoil pattern. First 8 shots have strong vertical pull,
 * then plateaus with increasing horizontal sway.
 */
function generateRiflePattern(): { x: number; y: number }[] {
    const pattern: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (let i = 1; i < 30; i++) {
        let y: number;
        let x: number;
        if (i < 8) {
            y = 1.5 + i * 0.6;
            x = Math.sin(i * 0.3) * 0.3;
        }

        else {
            y = 6 + Math.sin(i * 0.2) * 0.5;
            x = Math.sin(i * 0.5) * (1.5 + (i - 8) * 0.1);
        }
        pattern.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    return pattern;
}

/**
 * Default weapon VFX parameters applied to all weapons unless overridden.
 * Consumed by the rendering layer's projectile renderer, wall impact effects,
 * death burst lighting, and grid displacement system.
 * Typed as WeaponVfx (declared in global.d.ts).
 */
export const DEFAULT_WEAPON_VFX: WeaponVfx = {
    projectile: { tint: 0xffcc00, scale: 1, baseRadius: 3, blendMode: 'add' },
    bulletLight: { radius: 80, intensity: 2.0, color: 0xffcc00, trailAngle: 50 },
    wallImpact: {
        outerRadius: 18, outerColor: 0xffaa44, outerAlpha: 0.9,
        innerRadius: 12, innerColor: 0xffffff, innerAlpha: 0.7,
        duration: 250, initialScale: 0.2, blendMode: 'add',
        lightRadius: 100, lightColor: 0xffaa44, lightIntensity: 2.5, lightDecay: 300,
    },
    deathBurst: { lightRadius: 280, lightColor: 0xff3300, lightIntensity: 3.5, lightDecay: 900 },
    gridHit: { radius: 90, strength: 800 },
    gridTravel: { radius: 80, strength: 1500 },
};

/** Per-weapon VFX overrides. Only specified fields replace DEFAULT_WEAPON_VFX values. */
const WEAPON_VFX_OVERRIDES: Partial<Record<string, Partial<WeaponVfx>>> = {
    SNIPER: {
        projectile: { tint: 0xffffff, scale: 2, baseRadius: 3, blendMode: 'add' },
        bulletLight: { radius: 160, intensity: 2.5, color: 0xeeeeff, trailAngle: 50 },
    },
    SHRAPNEL: {
        projectile: { tint: 0xff6600, scale: 0.67, baseRadius: 3, blendMode: 'add' },
    },
};

/**
 * Returns the merged VFX config for a weapon, applying per-weapon overrides on top of defaults.
 * @param weaponType - The weapon ID, or undefined for default VFX.
 * @returns The fully resolved WeaponVfx config.
 */
export function getWeaponVfx(weaponType?: string): WeaponVfx {
    if (!weaponType) return DEFAULT_WEAPON_VFX;
    const overrides = WEAPON_VFX_OVERRIDES[weaponType];
    if (!overrides) return DEFAULT_WEAPON_VFX;
    return {
        projectile: overrides.projectile ?? DEFAULT_WEAPON_VFX.projectile,
        bulletLight: overrides.bulletLight ?? DEFAULT_WEAPON_VFX.bulletLight,
        wallImpact: overrides.wallImpact ?? DEFAULT_WEAPON_VFX.wallImpact,
        deathBurst: overrides.deathBurst ?? DEFAULT_WEAPON_VFX.deathBurst,
        gridHit: overrides.gridHit ?? DEFAULT_WEAPON_VFX.gridHit,
        gridTravel: overrides.gridTravel ?? DEFAULT_WEAPON_VFX.gridTravel,
    };
}

import { getConfig } from '@config/activeConfig';

/**
 * Returns the effective weapon definition, applying config overrides for damage multiplier,
 * bullet speed multiplier, and recoil multiplier. Falls back to PISTOL if type is unknown.
 * @param type - The weapon ID to look up.
 * @returns The resolved WeaponDef with config overrides applied.
 */
export function getWeaponDef(type: string): WeaponDef {
    const base = WEAPON_DEFS[type] || WEAPON_DEFS.PISTOL;
    const config = getConfig();
    const override = config.weapons.overrides[type];
    if (!override && config.weapons.globalDamageMultiplier === 1.0 && config.weapons.recoilMultiplier === 1.0 && config.physics.bulletSpeedMultiplier === 1.0) {
        return base;
    }
    const merged = override ? { ...base, ...override } : { ...base };
    if (config.weapons.globalDamageMultiplier !== 1.0) {
        merged.damage = Math.round(merged.damage * config.weapons.globalDamageMultiplier);
    }
    if (config.physics.bulletSpeedMultiplier !== 1.0) {
        merged.bulletSpeed = Math.round(merged.bulletSpeed * config.physics.bulletSpeedMultiplier);
    }
    if (config.weapons.recoilMultiplier !== 1.0) {
        merged.recoilPattern = merged.recoilPattern.map((p: { x: number; y: number }) => ({
            x: p.x * config.weapons.recoilMultiplier,
            y: p.y * config.weapons.recoilMultiplier,
        }));
    }
    return merged;
}

/**
 * Checks whether a weapon type is enabled in the current game config.
 * @param weaponId - The weapon ID to check.
 * @returns True if the weapon is allowed.
 */
export function isWeaponAllowed(weaponId: string): boolean {
    const allowed = getConfig().weapons.allowedWeapons;
    return allowed === 'ALL' || allowed.includes(weaponId);
}

/**
 * Creates the default starting weapon from config.
 * @returns A PlayerWeapon initialized with full ammo.
 */
export function createDefaultWeapon(): PlayerWeapon {
    const startingType = getConfig().weapons.startingWeapons[0] ?? 'PISTOL';
    const def = WEAPON_DEFS[startingType] ?? WEAPON_DEFS.PISTOL;
    return {
        id: 1,
        active: true,
        type: def.id,
        ammo: def.magSize,
        maxAmmo: def.magSize,
        firing_rate: def.fireRate,
        reloading: false,
    };
}
