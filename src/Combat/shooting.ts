import { getWeaponDef } from './weapons';
import { spawnBullet } from './projectiles';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { isPlayerDead } from './damage';
import { playSoundAtPlayer } from '../Audio/audio';
import { getWeaponSoundId, getWeaponReloadSoundId } from '../Audio/soundMap';

let isFiring = false;
let lastFireTime = 0;
let consecutiveShots = 0;
let recoilResetTimeout: ReturnType<typeof setTimeout> | null = null;
const RECOIL_RESET_DELAY = 300;
let shellReloadTimer: ReturnType<typeof setTimeout> | null = null;

export function getActiveWeapon(playerInfo: player_info): PlayerWeapon | undefined {
    return playerInfo.weapons.find(w => w.active);
}

export function initShooting(_playerInfo: player_info) {
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            e.preventDefault();
            isFiring = true;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isFiring = false;
            // Start recoil reset timer
            if (recoilResetTimeout) clearTimeout(recoilResetTimeout);
            recoilResetTimeout = setTimeout(() => {
                consecutiveShots = 0;
            }, RECOIL_RESET_DELAY);
        }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function tryFire(playerInfo: player_info, timestamp: number) {
    if (!isFiring) return;
    if (isPlayerDead(playerInfo)) return;

    const weapon = getActiveWeapon(playerInfo);
    if (!weapon) return;
    if (weapon.reloading) {
        // Shell-by-shell reload can be interrupted by firing
        const weaponDef = getWeaponDef(weapon.type);
        if (weaponDef.shellReloadTime && weapon.ammo > 0) {
            cancelShellReload(weapon);
        } else {
            return;
        }
    }

    const weaponDef = getWeaponDef(weapon.type);

    if (timestamp - lastFireTime < weaponDef.fireRate) return;
    if (weapon.ammo <= 0) {
        startReload(playerInfo);
        return;
    }

    lastFireTime = timestamp;
    weapon.ammo--;

    // Play weapon shoot sound
    playSoundAtPlayer(getWeaponSoundId(weapon.type), playerInfo);

    // Apply recoil before firing so the bullet goes where the crosshair is
    const patternIndex = Math.min(consecutiveShots, weaponDef.recoilPattern.length - 1);
    const recoil = weaponDef.recoilPattern[patternIndex];
    playerInfo.current_position.rotation += recoil.y;

    consecutiveShots++;

    // Calculate bullet origin (player center) and direction
    const centerX = playerInfo.current_position.x + HALF_HIT_BOX;
    const centerY = playerInfo.current_position.y + HALF_HIT_BOX;
    const aimAngle = playerInfo.current_position.rotation - ROTATION_OFFSET;

    // Spawn bullets (multiple for shotgun)
    for (let p = 0; p < weaponDef.pellets; p++) {
        let bulletAngle = aimAngle;
        // Apply spread
        if (weaponDef.spread > 0) {
            bulletAngle += (Math.random() - 0.5) * weaponDef.spread;
        }
        spawnBullet(
            playerInfo.id,
            centerX, centerY,
            bulletAngle,
            weaponDef.bulletSpeed,
            weaponDef.damage
        );
    }

    // Auto-reload on empty
    if (weapon.ammo <= 0) {
        startReload(playerInfo);
    }

    // Mechanical sound (shotgun pump, sniper bolt, etc.)
    if (weaponDef.mechanicalSound && weaponDef.mechanicalDelay && weapon.ammo > 0) {
        const soundId = weaponDef.mechanicalSound;
        setTimeout(() => {
            playSoundAtPlayer(soundId, playerInfo);
        }, weaponDef.mechanicalDelay);
    }
}

export function startReload(playerInfo: player_info) {
    const weapon = getActiveWeapon(playerInfo);
    if (!weapon || weapon.reloading) return;
    if (weapon.ammo >= weapon.maxAmmo) return;

    const weaponDef = getWeaponDef(weapon.type);
    weapon.reloading = true;

    if (weaponDef.shellReloadTime) {
        // Shell-by-shell reload
        loadNextShell(weapon, weaponDef, playerInfo);
    } else {
        // Full magazine reload
        playSoundAtPlayer(getWeaponReloadSoundId(weapon.type), playerInfo);

        setTimeout(() => {
            weapon.ammo = weapon.maxAmmo;
            weapon.reloading = false;
        }, weaponDef.reloadTime);
    }
}

function loadNextShell(weapon: PlayerWeapon, weaponDef: WeaponDef, playerInfo: player_info) {
    playSoundAtPlayer('shotgun_shell', playerInfo);

    shellReloadTimer = setTimeout(() => {
        shellReloadTimer = null;
        if (!weapon.reloading) return; // cancelled

        weapon.ammo++;

        if (weapon.ammo < weapon.maxAmmo) {
            loadNextShell(weapon, weaponDef, playerInfo);
        } else {
            weapon.reloading = false;
        }
    }, weaponDef.shellReloadTime!);
}

function cancelShellReload(weapon: PlayerWeapon) {
    weapon.reloading = false;
    if (shellReloadTimer) {
        clearTimeout(shellReloadTimer);
        shellReloadTimer = null;
    }
}

export function switchWeapon(playerInfo: player_info, index: number) {
    if (index < 0 || index >= playerInfo.weapons.length) return;

    // Cancel any active reload
    const currentWeapon = getActiveWeapon(playerInfo);
    if (currentWeapon) {
        currentWeapon.reloading = false;
        if (shellReloadTimer) {
            clearTimeout(shellReloadTimer);
            shellReloadTimer = null;
        }
        currentWeapon.active = false;
    }

    playerInfo.weapons[index].active = true;
    consecutiveShots = 0;

    // Play weapon switch sound (local only, no position)
    playSoundAtPlayer('weapon_switch', playerInfo);
}
