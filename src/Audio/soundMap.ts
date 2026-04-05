import { loadSound } from './audio';

// Weapon shoot sounds - keyed by weapon ID
const WEAPON_SOUNDS: Record<string, string> = {
    PISTOL: '/sounds/weapons/pistol_shoot.wav',
    SMG: '/sounds/weapons/smg_shoot.wav',
    RIFLE: '/sounds/weapons/rifle_shoot.wav',
    SHOTGUN: '/sounds/weapons/shotgun_shoot.wav',
    SNIPER: '/sounds/weapons/sniper_shoot.wav',
};

// Weapon reload sounds - keyed by weapon ID
const WEAPON_RELOAD_SOUNDS: Record<string, string> = {
    PISTOL: '/sounds/weapons/pistol_reload.mp3',
    SMG: '/sounds/weapons/smg_reload.mp3',
    RIFLE: '/sounds/weapons/rifle_reload.mp3',
    SHOTGUN: '/sounds/weapons/shotgun_reload.mp3',
    SNIPER: '/sounds/weapons/sniper_reload.mp3',
};

// Weapon mechanical sounds (pump, bolt, etc.)
const MECHANICAL_SOUNDS: Record<string, string> = {
    shotgun_pump: '/sounds/weapons/shotgun_pump.mp3',
    shotgun_shell: '/sounds/weapons/shotgun_shell.mp3',
    sniper_bolt: '/sounds/weapons/sniper_bolt.mp3',
};

// Action sounds
const ACTION_SOUNDS: Record<string, string> = {
    footstep: '/sounds/player/footstep.mp3',
    hit: '/sounds/player/hit.mp3',
    death: '/sounds/player/death.mp3',
    weapon_switch: '/sounds/player/weapon_switch.mp3',
};

// Grenade sounds
const GRENADE_SOUNDS: Record<string, string> = {
    grenade_throw: '/sounds/grenades/grenade_throw.mp3',
    grenade_bounce: '/sounds/grenades/grenade_bounce.mp3',
    frag_explode: '/sounds/grenades/frag_explode.wav',
    flash_explode: '/sounds/grenades/flash_explode.mp3',
    smoke_deploy: '/sounds/grenades/smoke_deploy.mp3',
    c4_explode: '/sounds/grenades/c4_explode.mp3',
};

export function getWeaponSoundId(weaponType: string): string {
    return `shoot_${weaponType}`;
}

export function getWeaponReloadSoundId(weaponType: string): string {
    return `reload_${weaponType}`;
}

export async function loadAllSounds(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [weaponType, url] of Object.entries(WEAPON_SOUNDS)) {
        promises.push(loadSound(getWeaponSoundId(weaponType), url));
    }

    for (const [weaponType, url] of Object.entries(WEAPON_RELOAD_SOUNDS)) {
        promises.push(loadSound(getWeaponReloadSoundId(weaponType), url));
    }

    for (const [id, url] of Object.entries(MECHANICAL_SOUNDS)) {
        promises.push(loadSound(id, url));
    }

    for (const [id, url] of Object.entries(ACTION_SOUNDS)) {
        promises.push(loadSound(id, url));
    }

    for (const [id, url] of Object.entries(GRENADE_SOUNDS)) {
        promises.push(loadSound(id, url));
    }

    await Promise.allSettled(promises);
}
