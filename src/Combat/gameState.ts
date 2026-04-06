import { getPlayerInfo, getAllPlayers, getPlayerElement, getHealthBarElement, ACTIVE_PLAYER } from '../Globals/Players';
import { getWeaponDef, createDefaultWeapon } from './weapons';
import { getGrenadeDef } from './grenades';
import { updateHealthBar, positionHealthBar } from '../Player/player';
import { getActiveMap } from '../Maps/helpers';
import { getConfig } from '../Config/activeConfig';
import { gameEventBus } from '../Net/GameEvent';

let roundStartTime = 0;
let matchActive = false;
let roundActive = false;
let currentRound = 0;
let intermissionTimer: ReturnType<typeof setTimeout> | null = null;
const teamRoundWins = new Map<number, number>();
const roundKills = new Map<number, number>(); // team -> kills this round
const playerStates = new Map<number, PlayerGameState>();
let matchWinner: number | null = null;

// Kill feed callback - set by HUD
let onKillCallback: ((killerName: string, victimName: string, weaponType: string) => void) | null = null;
let onRoundEndCallback: ((winningTeam: number, teamWins: Record<number, number>, isFinal: boolean) => void) | null = null;

export function setOnKillCallback(cb: (killerName: string, victimName: string, weaponType: string) => void) {
    onKillCallback = cb;
}

export function setOnRoundEndCallback(cb: (winningTeam: number, teamWins: Record<number, number>, isFinal: boolean) => void) {
    onRoundEndCallback = cb;
}

export function endMatch() {
    if (intermissionTimer !== null) {
        clearTimeout(intermissionTimer);
        intermissionTimer = null;
    }
    roundActive = false;
    matchActive = false;
}

export function initMatch(playerIds: number[]) {
    playerStates.clear();
    teamRoundWins.clear();
    roundKills.clear();
    matchWinner = null;
    currentRound = 0;

    // Discover teams from players
    const players = getAllPlayers();
    const teams = new Set(players.map((p) => p.team));
    for (const team of teams) {
        teamRoundWins.set(team, 0);
    }

    for (const id of playerIds) {
        playerStates.set(id, {
            playerId: id,
            kills: 0,
            deaths: 0,
            money: getConfig().economy.startingMoney,
            points: 0,
        });
    }

    startRound();
}

function startRound() {
    currentRound++;
    roundStartTime = Date.now();
    roundActive = true;
    matchActive = true;

    roundKills.clear();
    for (const [team] of teamRoundWins) {
        roundKills.set(team, 0);
    }

    resetAllPlayers();

    gameEventBus.emit({ type: 'ROUND_START', round: currentRound });
}

export function recordKill(killerId: number, victimId: number) {
    const killerState = playerStates.get(killerId);
    const victimState = playerStates.get(victimId);

    if (killerState) {
        killerState.kills++;
        killerState.points += 100;
        const killerInfo = getPlayerInfo(killerId);
        const activeWeapon = killerInfo?.weapons.find((w) => w.active);
        const weaponType = activeWeapon?.type || 'PISTOL';
        const weaponDef = getWeaponDef(weaponType);
        killerState.money += Math.round(weaponDef.killReward * getConfig().economy.killRewardMultiplier);

        if (killerInfo) {
            roundKills.set(killerInfo.team, (roundKills.get(killerInfo.team) ?? 0) + 1);
        }

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
    if (!roundActive) return 0;
    return Math.max(0, getConfig().match.roundDuration - (Date.now() - roundStartTime));
}

export function checkMatchTimer(): boolean {
    if (!roundActive) return false;
    if (getMatchTimeRemaining() <= 0) {
        endRound();
        return true;
    }
    return false;
}

export function isMatchActive(): boolean {
    return matchActive;
}

export function isRoundActive(): boolean {
    return roundActive;
}

export function getCurrentRound(): number {
    return currentRound;
}

export function getTeamRoundWins(): Record<number, number> {
    const result: Record<number, number> = {};
    for (const [team, wins] of teamRoundWins) {
        result[team] = wins;
    }
    return result;
}

export function getMatchWinner(): number | null {
    return matchWinner;
}

function endRound() {
    roundActive = false;

    // Determine round winner: team with most kills this round
    let bestTeam = 1;
    let bestKills = -1;
    for (const [team, kills] of roundKills) {
        if (kills > bestKills) {
            bestKills = kills;
            bestTeam = team;
        }
    }

    teamRoundWins.set(bestTeam, (teamRoundWins.get(bestTeam) ?? 0) + 1);
    const wins = teamRoundWins.get(bestTeam)!;

    // Check for match win
    const isFinal = wins >= getConfig().match.roundsToWin;
    if (isFinal) {
        matchActive = false;
        matchWinner = bestTeam;
    }

    const teamWinsRecord: Record<number, number> = {};
    for (const [team, wins2] of teamRoundWins) {
        teamWinsRecord[team] = wins2;
    }

    if (onRoundEndCallback) {
        onRoundEndCallback(bestTeam, teamWinsRecord, isFinal);
    }

    // Start next round after intermission (unless match is over)
    if (!isFinal) {
        intermissionTimer = setTimeout(() => startRound(), getConfig().match.roundIntermission);
    }
}

function resetAllPlayers() {
    const teamSpawns = getActiveMap().teamSpawns;
    const players = getAllPlayers();
    const teamCounters: Record<number, number> = {};

    for (const player of players) {
        teamCounters[player.team] = teamCounters[player.team] ?? 0;
        const spawns = teamSpawns[player.team] ?? Object.values(teamSpawns).flat();
        const spawn = spawns[teamCounters[player.team] % spawns.length];
        teamCounters[player.team]++;

        player.health = getConfig().player.maxHealth;
        player.armour = getConfig().player.startingArmor;
        player.dead = false;
        player.current_position.x = spawn.x;
        player.current_position.y = spawn.y;
        player.weapons = [createDefaultWeapon()];
        player.grenades = { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 };

        const el = getPlayerElement(player.id);
        if (el) {
            el.classList.remove('dead');
            el.style.transform = `translate3d(${spawn.x}px, ${spawn.y}px, 0) rotate(${player.current_position.rotation}deg)`;
            if (player.id === ACTIVE_PLAYER) {
                el.classList.add('visible');
            }
        }

        const wrap = getHealthBarElement(player.id);
        if (wrap) positionHealthBar(wrap, player);
        updateHealthBar(player);
    }

    // Reset money for the new round
    for (const [, state] of playerStates) {
        state.money = getConfig().economy.startingMoney;
    }
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
    const existing = playerInfo.weapons.find((w) => w.type === weaponType);
    if (existing) {
        existing.ammo = existing.maxAmmo;
        return true;
    }

    // Deactivate current weapon
    playerInfo.weapons.forEach((w) => (w.active = false));

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

export function buyGrenade(playerId: number, type: GrenadeType, playerInfo: player_info): boolean {
    const def = getGrenadeDef(type);
    if (playerInfo.grenades[type] >= 1) return false;
    if (!spendMoney(playerId, def.price)) return false;
    playerInfo.grenades[type]++;
    return true;
}

export function buyArmor(playerId: number, playerInfo: player_info): boolean {
    const armorCost = getConfig().economy.armorCost;
    if (playerInfo.armour >= getConfig().player.maxArmor) return false;
    if (!spendMoney(playerId, armorCost)) return false;
    playerInfo.armour = getConfig().player.maxArmor;
    return true;
}

export function buyHealth(playerId: number, playerInfo: player_info): boolean {
    const healthCost = getConfig().economy.healthCost;
    if (playerInfo.health >= getConfig().player.maxHealth) return false;
    if (!spendMoney(playerId, healthCost)) return false;
    playerInfo.health = getConfig().player.maxHealth;
    return true;
}
