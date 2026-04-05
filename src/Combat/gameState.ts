import { getPlayerInfo } from '../Globals/Players';
import { getWeaponDef } from './weapons';

const STARTING_MONEY = 99999;
const MATCH_DURATION = 5 * 60 * 1000; // 5 minutes

let matchStartTime = 0;
let matchActive = false;
const playerStates = new Map<number, PlayerGameState>();

// Kill feed callback - set by HUD
let onKillCallback: ((killerName: string, victimName: string, weaponType: string) => void) | null = null;

export function setOnKillCallback(cb: (killerName: string, victimName: string, weaponType: string) => void) {
    onKillCallback = cb;
}

export function initMatch(playerIds: number[]) {
    playerStates.clear();
    for (const id of playerIds) {
        playerStates.set(id, {
            playerId: id,
            kills: 0,
            deaths: 0,
            money: STARTING_MONEY,
            points: 0,
        });
    }
    matchStartTime = Date.now();
    matchActive = true;
}

export function recordKill(killerId: number, victimId: number) {
    const killerState = playerStates.get(killerId);
    const victimState = playerStates.get(victimId);

    if (killerState) {
        killerState.kills++;
        killerState.points += 100;
        const killerInfo = getPlayerInfo(killerId);
        const activeWeapon = killerInfo?.weapons.find(w => w.active);
        const weaponType = activeWeapon?.type || 'PISTOL';
        const weaponDef = getWeaponDef(weaponType);
        killerState.money += weaponDef.killReward;

        // Trigger kill feed
        const victimInfo = getPlayerInfo(victimId);
        if (onKillCallback && killerInfo && victimInfo) {
            onKillCallback(killerInfo.name, victimInfo.name, weaponType);
        }
    }

    if (victimState) {
        victimState.deaths++;
    }
}

export function getPlayerState(playerId: number): PlayerGameState | undefined {
    return playerStates.get(playerId);
}

export function getAllPlayerStates(): PlayerGameState[] {
    return Array.from(playerStates.values());
}

export function getMatchTimeRemaining(): number {
    if (!matchActive) return 0;
    return Math.max(0, MATCH_DURATION - (Date.now() - matchStartTime));
}

export function checkMatchTimer(): boolean {
    if (!matchActive) return false;
    if (getMatchTimeRemaining() <= 0) {
        matchActive = false;
        return true; // match ended
    }
    return false;
}

export function isMatchActive(): boolean {
    return matchActive;
}

export function spendMoney(playerId: number, amount: number): boolean {
    const state = playerStates.get(playerId);
    if (!state || state.money < amount) return false;
    state.money -= amount;
    return true;
}

export function buyWeapon(playerId: number, weaponType: string, playerInfo: player_info): boolean {
    const weaponDef = getWeaponDef(weaponType);
    if (!spendMoney(playerId, weaponDef.price)) return false;

    // Check if player already has this weapon
    const existing = playerInfo.weapons.find(w => w.type === weaponType);
    if (existing) {
        existing.ammo = existing.maxAmmo;
        return true;
    }

    // Deactivate current weapon
    playerInfo.weapons.forEach(w => w.active = false);

    // Add new weapon
    playerInfo.weapons.push({
        id: playerInfo.weapons.length + 1,
        active: true,
        type: weaponType,
        ammo: weaponDef.magSize,
        maxAmmo: weaponDef.magSize,
        firing_rate: weaponDef.fireRate,
        reloading: false,
    });

    return true;
}
