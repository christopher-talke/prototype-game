import { getConfig } from '@config/activeConfig';

export const GRENADE_DEFS: Record<GrenadeType, GrenadeDef> = {
    FRAG: {
        id: 'FRAG',
        name: 'Frag Grenade',
        price: 300,
        throwSpeed: 30,
        fuseTime: 2000,
        radius: 150,
        damage: 100,
        effectDuration: 0,
        shrapnelCount: 30,
        shrapnelDamage: 40,
        shrapnelSpeed: 20,
    },
    FLASH: {
        id: 'FLASH',
        name: 'Flashbang',
        price: 200,
        throwSpeed: 35,
        fuseTime: 1500,
        radius: 250,
        damage: 0,
        effectDuration: 3000,
    },
    SMOKE: {
        id: 'SMOKE',
        name: 'Smoke Grenade',
        price: 300,
        throwSpeed: 28,
        fuseTime: 1500,
        radius: 120,
        damage: 0,
        effectDuration: 15000,
    },
    C4: {
        id: 'C4',
        name: 'C4 Explosive',
        price: 400,
        throwSpeed: 0,
        fuseTime: 0, // manual detonate
        radius: 200,
        damage: 150,
        effectDuration: 0,
        shrapnelCount: 80,
        shrapnelDamage: 60,
        shrapnelSpeed: 20,
    },
};

export function getGrenadeDef(type: GrenadeType): GrenadeDef {
    return GRENADE_DEFS[type];
}

export function isGrenadeAllowed(type: GrenadeType): boolean {
    const allowed = getConfig().grenades.allowedGrenades;
    return allowed === 'ALL' || allowed.includes(type);
}

export function createDefaultGrenades(): Record<GrenadeType, number> {
    const starting = getConfig().grenades.startingGrenades;
    return {
        FRAG: starting.FRAG ?? 0,
        FLASH: starting.FLASH ?? 0,
        SMOKE: starting.SMOKE ?? 0,
        C4: starting.C4 ?? 0,
    };
}