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

function generateSMGPattern(): { x: number; y: number }[] {
    const pattern: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (let i = 1; i < 30; i++) {
        const y = Math.min(1.2 + i * 0.15, 3.5);
        const x = Math.sin(i * 0.4) * (0.5 + i * 0.05);
        pattern.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    return pattern;
}

function generateRiflePattern(): { x: number; y: number }[] {
    const pattern: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (let i = 1; i < 30; i++) {
        let y: number;
        let x: number;
        if (i < 8) {
            // Strong vertical pull for first 8 shots
            y = 1.5 + i * 0.6;
            x = Math.sin(i * 0.3) * 0.3;
        } else {
            // Plateau vertical, increase horizontal sway
            y = 6 + Math.sin(i * 0.2) * 0.5;
            x = Math.sin(i * 0.5) * (1.5 + (i - 8) * 0.1);
        }
        pattern.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    return pattern;
}

import { getConfig } from '../Config/activeConfig';

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
        merged.recoilPattern = merged.recoilPattern.map(p => ({
            x: p.x * config.weapons.recoilMultiplier,
            y: p.y * config.weapons.recoilMultiplier,
        }));
    }
    return merged;
}

export function isWeaponAllowed(weaponId: string): boolean {
    const allowed = getConfig().weapons.allowedWeapons;
    return allowed === 'ALL' || allowed.includes(weaponId);
}

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