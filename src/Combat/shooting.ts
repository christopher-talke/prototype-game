import { getWeaponDef } from './weapons';
import { spawnBullet } from './projectiles';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { isPlayerDead } from './damage';

let isFiring = false;
let lastFireTime = 0;
let consecutiveShots = 0;
let recoilResetTimeout: ReturnType<typeof setTimeout> | null = null;
const RECOIL_RESET_DELAY = 300;

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
    if (weapon.reloading) return;

    const weaponDef = getWeaponDef(weapon.type);

    if (timestamp - lastFireTime < weaponDef.fireRate) return;
    if (weapon.ammo <= 0) {
        startReload(playerInfo);
        return;
    }

    lastFireTime = timestamp;
    weapon.ammo--;

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
}

export function startReload(playerInfo: player_info) {
    const weapon = getActiveWeapon(playerInfo);
    if (!weapon || weapon.reloading) return;
    if (weapon.ammo >= weapon.maxAmmo) return;

    const weaponDef = getWeaponDef(weapon.type);
    weapon.reloading = true;

    setTimeout(() => {
        weapon.ammo = weapon.maxAmmo;
        weapon.reloading = false;
    }, weaponDef.reloadTime);
}

export function switchWeapon(playerInfo: player_info, index: number) {
    if (index < 0 || index >= playerInfo.weapons.length) return;

    // Cancel any active reload
    const currentWeapon = getActiveWeapon(playerInfo);
    if (currentWeapon) {
        currentWeapon.reloading = false;
        currentWeapon.active = false;
    }

    playerInfo.weapons[index].active = true;
    consecutiveShots = 0;
}
