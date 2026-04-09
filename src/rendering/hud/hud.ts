import './hud.css';
import { getWeaponDef, WEAPON_DEFS, isWeaponAllowed } from '@simulation/combat/weapons';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getAdapter } from '@net/activeAdapter';
import { isPlayerDead } from '@simulation/combat/damage';
import { getAllPlayers, ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
import { GRENADE_DEFS } from '@simulation/combat/grenades';
import { getSelectedGrenadeType, getGrenadeChargePercent } from '@simulation/inputController';
import { getKeyForAction, getKeyDisplayName } from '@ui/settings/keybinds';
import { playSound } from '@audio/audio';
import { getConfig } from '@config/activeConfig';
import { app } from '../../app';
import { cssTransform } from '../cssTransform';

let healthBar: HTMLElement;
let armorBar: HTMLElement;
let ammoCount: HTMLElement;
let ammoMax: HTMLElement;
let weaponName: HTMLElement;
let reloadText: HTMLElement;
let moneyDisplay: HTMLElement;
let timerDisplay: HTMLElement;
let scoreDisplay: HTMLElement;
let killFeed: HTMLElement;
let crosshair: HTMLElement;
let buyMenu: HTMLElement;
let buyMenuGrid: HTMLElement;
let deathOverlay: HTMLElement;
let leaderboard: HTMLElement;
let leaderboardBody: HTMLElement;
let grenadeHud: HTMLElement;
let roundScoreDisplay: HTMLElement;
let roundBanner: HTMLElement;
let matchEndOverlay: HTMLElement;
let grenadeChargeBar: HTMLElement;
let grenadeChargeFill: HTMLElement;
const grenadeSlotCache = new Map<GrenadeType, { slot: HTMLElement; count: HTMLElement }>();
let onReturnToMenuCallback: (() => void) | null = null;
let pauseOverlay: HTMLElement | null = null;
let paused = false;

// HUD value caches - avoid DOM writes when values haven't changed
let _lastHealthPct = -1;
let _lastArmorPct = -1;
let _lastFilterStr = '';
let _lastWeaponName = '';
let _lastAmmo = '';
let _lastAmmoMax = '';
let _lastReloadDisplay = '';
let _lastMoney = '';
let _lastTimer = '';
let _lastRoundScore = '';
let _lastScore = '';
let _lastDeathActive = false;
let _lastChargeActive = false;

export function setOnReturnToMenuCallback(cb: () => void) {
    onReturnToMenuCallback = cb;
}

export function isPauseOpen(): boolean {
    return paused;
}

export function openPause() {
    paused = true;
    pauseOverlay = document.getElementById('hud-pause');
    pauseOverlay?.classList.add('active');
    document.body.style.cursor = 'auto';
}

export function closePause() {
    paused = false;
    pauseOverlay?.classList.remove('active');
    document.body.style.cursor = 'none';
}

export function initHUD() {
    const container = document.createElement('div');
    container.id = 'hud-container';

    // Status bars
    const status = document.createElement('div');
    status.id = 'hud-status';
    status.innerHTML = `
        <div class="hud-bar-label">HP</div>
        <div class="hud-bar-container"><div class="hud-bar" id="hud-health-bar"></div></div>
        <div class="hud-bar-label">ARMOR</div>
        <div class="hud-bar-container"><div class="hud-bar" id="hud-armor-bar"></div></div>
    `;
    container.appendChild(status);

    // Ammo
    const ammo = document.createElement('div');
    ammo.id = 'hud-ammo';
    ammo.innerHTML = `
        <div id="hud-weapon-name"></div>
        <span id="hud-ammo-count">12</span>
        <span id="hud-ammo-max">/ 12</span>
        <div id="hud-reload-text" style="display:none">RELOADING</div>
    `;
    container.appendChild(ammo);

    // Money
    const money = document.createElement('div');
    money.id = 'hud-money';
    money.textContent = '$800';
    container.appendChild(money);

    // Timer
    const timer = document.createElement('div');
    timer.id = 'hud-timer';
    timer.textContent = '5:00';
    container.appendChild(timer);

    // Round score (team round wins)
    const rs = document.createElement('div');
    rs.id = 'hud-round-score';
    rs.textContent = 'Round 1';
    container.appendChild(rs);

    // Score
    const score = document.createElement('div');
    score.id = 'hud-score';
    score.textContent = 'K: 0 / D: 0';
    container.appendChild(score);

    // Grenade inventory display
    const grenades = document.createElement('div');
    grenades.id = 'hud-grenades';
    const gKey = getKeyDisplayName(getKeyForAction('grenade'));
    grenades.innerHTML = `
        <div class="grenade-slot" data-type="FRAG"><span class="grenade-key">${gKey}</span><span class="grenade-label">FRAG</span><span class="grenade-count">0</span></div>
        <div class="grenade-slot" data-type="FLASH"><span class="grenade-key">${gKey}</span><span class="grenade-label">FLASH</span><span class="grenade-count">0</span></div>
        <div class="grenade-slot" data-type="SMOKE"><span class="grenade-key">${gKey}</span><span class="grenade-label">SMOKE</span><span class="grenade-count">0</span></div>
        <div class="grenade-slot" data-type="C4"><span class="grenade-key">${gKey}</span><span class="grenade-label">C4</span><span class="grenade-count">0</span></div>
    `;
    container.appendChild(grenades);

    // Kill feed
    const kf = document.createElement('div');
    kf.id = 'hud-killfeed';
    container.appendChild(kf);

    document.body.appendChild(container);

    // Crosshair
    const ch = document.createElement('div');
    ch.id = 'hud-crosshair';
    ch.innerHTML = `<div class="ch-h"></div><div class="ch-v"></div><div class="ch-dot"></div>`;
    document.body.appendChild(ch);

    // Grenade charge bar (shown under crosshair while holding G)
    const gcb = document.createElement('div');
    gcb.id = 'grenade-charge-bar';
    gcb.innerHTML = `<div id="grenade-charge-fill"></div>`;
    document.body.appendChild(gcb);

    // Buy menu
    const bm = document.createElement('div');
    bm.id = 'hud-buymenu';
    bm.classList.add('menu-overlay', 'menu-overlay--translucent');
    bm.innerHTML = `<div class="buymenu-panel"><h3>BUY MENU [B to close]</h3><div class="buymenu-grid" id="buymenu-grid"></div></div>`;
    document.body.appendChild(bm);

    // Death overlay
    const dOverlay = document.createElement('div');
    dOverlay.id = 'hud-death-overlay';
    dOverlay.innerHTML = `<div id="hud-death-text">YOU DIED</div>`;
    document.body.appendChild(dOverlay);

    // Damage indicator (directional red flash)
    const dmgIndicator = document.createElement('div');
    dmgIndicator.id = 'hud-damage-indicator';
    document.body.appendChild(dmgIndicator);

    // Leaderboard
    const lb = document.createElement('div');
    lb.id = 'hud-leaderboard';
    lb.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Points</th>
                    <th>K</th>
                    <th>D</th>
                </tr>
            </thead>
            <tbody id="leaderboard-body"></tbody>
        </table>
    `;
    document.body.appendChild(lb);

    // Round end banner
    const rb = document.createElement('div');
    rb.id = 'hud-round-banner';
    rb.classList.add('menu-overlay', 'menu-overlay--translucent');
    rb.innerHTML = `<div id="round-banner-text">ROUND OVER</div><div id="round-banner-sub"></div>`;
    document.body.appendChild(rb);

    // Match end overlay
    const meo = document.createElement('div');
    meo.id = 'hud-match-end';
    meo.classList.add('menu-overlay', 'menu-overlay--translucent');
    meo.innerHTML = `<div id="match-end-title">MATCH OVER</div><div id="match-end-winner"></div><div id="match-end-score"></div><button id="match-end-return">Return to Menu</button>`;
    document.body.appendChild(meo);

    // Pause overlay
    const pause = document.createElement('div');
    pause.id = 'hud-pause';
    pause.classList.add('menu-overlay', 'menu-overlay--translucent');
    pause.innerHTML = `
        <div id="pause-title">PAUSED</div>
        <button id="pause-resume">Resume</button>
        <button id="pause-return">Return to Menu</button>
    `;
    document.body.appendChild(pause);

    // Cache elements
    healthBar = document.getElementById('hud-health-bar')!;
    armorBar = document.getElementById('hud-armor-bar')!;
    ammoCount = document.getElementById('hud-ammo-count')!;
    ammoMax = document.getElementById('hud-ammo-max')!;
    weaponName = document.getElementById('hud-weapon-name')!;
    reloadText = document.getElementById('hud-reload-text')!;
    moneyDisplay = document.getElementById('hud-money')!;
    timerDisplay = document.getElementById('hud-timer')!;
    scoreDisplay = document.getElementById('hud-score')!;
    killFeed = document.getElementById('hud-killfeed')!;
    crosshair = ch;
    buyMenu = bm;
    buyMenuGrid = document.getElementById('buymenu-grid')!;
    deathOverlay = dOverlay;
    leaderboard = lb;
    leaderboardBody = document.getElementById('leaderboard-body')!;
    grenadeHud = document.getElementById('hud-grenades')!;
    roundScoreDisplay = rs;
    roundBanner = rb;
    matchEndOverlay = meo;
    grenadeChargeBar = gcb;
    grenadeChargeFill = document.getElementById('grenade-charge-fill')!;

    document.getElementById('match-end-return')!.addEventListener('click', () => {
        onReturnToMenuCallback?.();
    });

    document.getElementById('pause-resume')!.addEventListener('click', closePause);
    document.getElementById('pause-return')!.addEventListener('click', () => {
        closePause();
        onReturnToMenuCallback?.();
    });

    // Cache grenade slot elements
    grenadeHud.querySelectorAll('.grenade-slot').forEach((slot) => {
        const type = slot.getAttribute('data-type') as GrenadeType;
        const count = slot.querySelector('.grenade-count') as HTMLElement;
        grenadeSlotCache.set(type, { slot: slot as HTMLElement, count });
    });
    // deathText element exists in DOM but doesn't need a JS reference
}

export function updateHUD(playerInfo: player_info, timeRemaining: number) {
    const adapter = getAdapter();
    const state = adapter.getPlayerState(playerInfo.id);
    if (!state) return;

    // Health bar - only update DOM when value changes
    const healthPct = Math.max(0, playerInfo.health);
    if (healthPct !== _lastHealthPct) {
        _lastHealthPct = healthPct;
        healthBar.style.width = `${healthPct}%`;
        if (healthPct > 50) {
            healthBar.style.background = '#4ade80';
        } else if (healthPct > 25) {
            healthBar.style.background = '#fbbf24';
        } else {
            healthBar.style.background = '#ef4444';
        }

        // Low-health desaturation + blur on the game world
        const disableEffects = getConfig().gameplay.disableLowHealthEffects;
        if (!disableEffects) {
            const t = healthPct / 100;
            const filterStr = `saturate(${t.toFixed(3)}) blur(${((1 - t) * 1.5).toFixed(2)}px)`;
            if (filterStr !== _lastFilterStr) {
                _lastFilterStr = filterStr;
                app.style.filter = filterStr;
            }
        }
    }

    // Armor bar
    const armorPct = Math.max(0, playerInfo.armour);
    if (armorPct !== _lastArmorPct) {
        _lastArmorPct = armorPct;
        armorBar.style.width = `${armorPct}%`;
    }

    // Ammo
    const weapon = getActiveWeapon(playerInfo);
    if (weapon) {
        const wDef = getWeaponDef(weapon.type);
        if (wDef.name !== _lastWeaponName) { _lastWeaponName = wDef.name; weaponName.textContent = wDef.name; }
        const ammoStr = `${weapon.ammo}`;
        if (ammoStr !== _lastAmmo) { _lastAmmo = ammoStr; ammoCount.textContent = ammoStr; }
        const ammoMaxStr = `/ ${weapon.maxAmmo}`;
        if (ammoMaxStr !== _lastAmmoMax) { _lastAmmoMax = ammoMaxStr; ammoMax.textContent = ammoMaxStr; }
        const reloadDisplay = weapon.reloading ? 'block' : 'none';
        if (reloadDisplay !== _lastReloadDisplay) { _lastReloadDisplay = reloadDisplay; reloadText.style.display = reloadDisplay; }
        crosshair.dataset.weapon = weapon.type;
    }

    // Money
    const moneyStr = `$${state.money}`;
    if (moneyStr !== _lastMoney) { _lastMoney = moneyStr; moneyDisplay.textContent = moneyStr; }

    // Timer
    const totalSecs = Math.ceil(timeRemaining / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (timerStr !== _lastTimer) { _lastTimer = timerStr; timerDisplay.textContent = timerStr; }

    // Round score
    const wins = adapter.getTeamRoundWins();
    const round = adapter.getCurrentRound();
    const winsArr = Object.entries(wins).map(([t, w]) => [Number(t), w] as [number, number]).sort((a, b) => a[0] - b[0]);
    const winsText = winsArr.map(([t, w]) => `T${t}: ${w}`).join('  ');
    const roundScoreStr = `Round ${round}  |  ${winsText}  |  First to ${getConfig().match.roundsToWin}`;
    if (roundScoreStr !== _lastRoundScore) { _lastRoundScore = roundScoreStr; roundScoreDisplay.textContent = roundScoreStr; }

    // Score
    const scoreStr = `K: ${state.kills} / D: ${state.deaths}`;
    if (scoreStr !== _lastScore) { _lastScore = scoreStr; scoreDisplay.textContent = scoreStr; }

    // Grenade inventory
    if (playerInfo.grenades) {
        const selected = getSelectedGrenadeType();
        for (const [type, { slot, count }] of grenadeSlotCache) {
            const has = playerInfo.grenades[type] || 0;
            count.textContent = `${has}`;
            slot.classList.toggle('has-grenade', has > 0);
            slot.classList.toggle('selected', type === selected);
        }
    }

    // Death overlay
    const dead = isPlayerDead(playerInfo);
    if (dead !== _lastDeathActive) {
        _lastDeathActive = dead;
        deathOverlay.classList.toggle('active', dead);
    }

    // Grenade charge bar
    const chargePercent = getGrenadeChargePercent();
    const chargeActive = chargePercent > 0;
    if (chargeActive) {
        if (!_lastChargeActive) grenadeChargeBar.classList.add('active');
        grenadeChargeFill.style.width = `${chargePercent * 100}%`;
    } else if (_lastChargeActive) {
        grenadeChargeBar.classList.remove('active');
    }
    _lastChargeActive = chargeActive;
}

export function addKillFeedEntry(killerName: string, victimName: string, weaponType: string) {
    const entry = document.createElement('div');
    entry.classList.add('killfeed-entry');
    entry.textContent = `${killerName} [${weaponType}] ${victimName}`;
    killFeed.appendChild(entry);

    setTimeout(() => entry.remove(), 4000);
}

let buyMenuOpen = false;

export function toggleBuyMenu(playerInfo: player_info) {
    buyMenuOpen = !buyMenuOpen;

    if (buyMenuOpen) {
        renderBuyMenu(playerInfo);
        buyMenu.classList.add('open');
        getAdapter().sendInput({ type: 'OPEN_BUY_MENU', playerId: playerInfo.id });
    } else {
        buyMenu.classList.remove('open');
        getAdapter().sendInput({ type: 'CLOSE_BUY_MENU', playerId: playerInfo.id });
    }
}

export function isBuyMenuOpen(): boolean {
    return buyMenuOpen;
}

export function closeBuyMenu() {
    if (buyMenuOpen) {
        buyMenuOpen = false;
        buyMenu.classList.remove('open');
        if (ACTIVE_PLAYER != null) {
            const playerInfo = getPlayerInfo(ACTIVE_PLAYER);
            if (playerInfo) getAdapter().sendInput({ type: 'CLOSE_BUY_MENU', playerId: playerInfo.id });
        }
    }
}

function renderBuyMenu(playerInfo: player_info) {
    const state = getAdapter().getPlayerState(playerInfo.id);
    if (!state) return;

    buyMenuGrid.innerHTML = '';

    const disableHealth = getConfig().economy.disableHealth;
    const disableArmor = getConfig().economy.disableArmor;

    const healthAndArmourHeader = document.createElement('div');
    healthAndArmourHeader.classList.add('buymenu-section-header');
    healthAndArmourHeader.textContent = 'HEALTH & ARMOUR';

    if (!disableHealth || !disableArmor) {
        buyMenuGrid.appendChild(healthAndArmourHeader);
    }

    const healthAndArmour =  [
        ['Health', getConfig().economy.healthCost, () => getAdapter().sendInput({ type: 'BUY_HEALTH', playerId: playerInfo.id })],
        ['Armor', getConfig().economy.armorCost, () => getAdapter().sendInput({ type: 'BUY_ARMOR', playerId: playerInfo.id })],
    ] as [string, number, () => void][];
    for (const [label, cost, buy] of healthAndArmour) {
        const item = document.createElement('div');

        if ((label === 'Health' && disableHealth) || (label === 'Armor' && disableArmor)) continue;

        item.classList.add('buymenu-item');
        if (state.money < cost) item.classList.add('too-expensive');
        item.innerHTML = `<div class="buymenu-item-name">${label}</div><div class="buymenu-item-price">$${cost}</div>`;
        item.addEventListener('click', () => {
            if (state.money >= cost) { buy(); renderBuyMenu(playerInfo); }
        });

        buyMenuGrid.appendChild(item);
    }

    // Weapon section
    const weaponHeader = document.createElement('div');
    weaponHeader.classList.add('buymenu-section-header');
    weaponHeader.textContent = 'WEAPONS';
    buyMenuGrid.appendChild(weaponHeader);

    Object.values(WEAPON_DEFS).forEach((wDef) => {
        if (wDef.price === 0) return; // Don't show pistol (free)
        if (!isWeaponAllowed(wDef.id)) return;

        const item = document.createElement('div');
        item.classList.add('buymenu-item');
        if (state.money < wDef.price) {
            item.classList.add('too-expensive');
        }

        item.innerHTML = `
            <div class="buymenu-item-name">${wDef.name}</div>
            <div class="buymenu-item-price">$${wDef.price}</div>
            <div class="buymenu-item-stats">DMG: ${wDef.damage} | RPM: ${Math.round(60000 / wDef.fireRate)} | MAG: ${wDef.magSize}</div>
        `;

        item.addEventListener('click', () => {
            if (state.money >= wDef.price) {
                getAdapter().sendInput({ type: 'BUY_WEAPON', playerId: playerInfo.id, weaponType: wDef.id });
                renderBuyMenu(playerInfo); // Re-render to update money
            }
        });

        buyMenuGrid.appendChild(item);
    });

    // Grenade section
    const grenadeHeader = document.createElement('div');
    grenadeHeader.classList.add('buymenu-section-header');
    grenadeHeader.textContent = 'GRENADES';
    buyMenuGrid.appendChild(grenadeHeader);

    Object.values(GRENADE_DEFS).forEach((gDef) => {
        const item = document.createElement('div');
        item.classList.add('buymenu-item');
        const owned = playerInfo.grenades[gDef.id] >= 1;
        if (state.money < gDef.price || owned) {
            item.classList.add('too-expensive');
        }

        item.innerHTML = `
            <div class="buymenu-item-name">${gDef.name}${owned ? ' (owned)' : ''}</div>
            <div class="buymenu-item-price">$${gDef.price}</div>
        `;

        item.addEventListener('click', () => {
            if (!owned && state.money >= gDef.price) {
                getAdapter().sendInput({ type: 'BUY_GRENADE', playerId: playerInfo.id, grenadeType: gDef.id });
                renderBuyMenu(playerInfo);
            }
        });

        buyMenuGrid.appendChild(item);
    });
}

let damageIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;

export function showDamageIndicator(angleDeg: number, playerRotation: number) {
    const el = document.getElementById('hud-damage-indicator');
    if (!el) return;

    const relativeAngle = angleDeg - playerRotation;
    el.style.setProperty('--dmg-angle', `${relativeAngle}deg`);
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');

    if (damageIndicatorTimeout) clearTimeout(damageIndicatorTimeout);
    damageIndicatorTimeout = setTimeout(() => {
        el.classList.remove('active');
    }, 600);
}

export function updateCrosshairPosition(x: number, y: number) {
    crosshair.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
    grenadeChargeBar.style.transform = `translate(calc(${x}px - 50%), calc(${y}px + 20px))`;
}

let hitMarkerTimeout: ReturnType<typeof setTimeout> | null = null;

export function showHitMarker(isKill: boolean, victimName?: string) {
    crosshair.classList.remove('hit', 'kill');
    // Force reflow so animation restarts
    void crosshair.offsetWidth;
    crosshair.classList.add(isKill ? 'kill' : 'hit');
    if (hitMarkerTimeout) clearTimeout(hitMarkerTimeout);
    hitMarkerTimeout = setTimeout(() => {
        crosshair.classList.remove('hit', 'kill');
    }, 300);

    if (isKill) {
        playSound('kill');
        showKillBanner(victimName ?? 'Enemy');
    }
}

let killBannerContainer: HTMLElement | null = null;

function getKillBannerContainer(): HTMLElement {
    if (!killBannerContainer) {
        killBannerContainer = document.createElement('div');
        killBannerContainer.id = 'kill-banner-container';
        document.body.appendChild(killBannerContainer);
    }
    return killBannerContainer;
}

function showKillBanner(victimName: string) {
    const container = getKillBannerContainer();
    const el = document.createElement('div');
    el.classList.add('kill-banner');
    el.innerHTML = `<span class="kill-banner-icon">&#x2620;</span><span class="kill-banner-text">ELIMINATED</span><span class="kill-banner-name">${victimName}</span>`;
    container.appendChild(el);
    void el.offsetWidth;
    el.classList.add('active');
    setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 500);
    }, 1200);
}

export function showLeaderboard() {
    renderLeaderboard();
    leaderboard.classList.add('open');
}

export function hideLeaderboard() {
    leaderboard.classList.remove('open');
}

/**
 * Shows the round end banner with the winning team and team scores.
 * @param winningTeam The team that won the round.
 * @param teamWins A map of team IDs to their respective win counts.
 * @param isFinal Whether this round is the final round of the match.
 * @returns void
 */
export function showRoundEndBanner(winningTeam: number, teamWins: Record<number, number>, isFinal: boolean) {
    if (isFinal) {
        showMatchEndOverlay(winningTeam, teamWins);
        return;
    }

    const sub = document.getElementById('round-banner-sub')!;
    const winsArr = Object.entries(teamWins).map(([t, w]) => [Number(t), w] as [number, number]).sort((a, b) => a[0] - b[0]);
    const scoreText = winsArr.map(([t, w]) => `Team ${t}: ${w}`).join('<br />');
    sub.innerHTML = `Team ${winningTeam} wins!<br /><br />${scoreText}`;

    roundBanner.classList.remove('active');
    void roundBanner.offsetWidth;
    roundBanner.classList.add('active');

    if (winningTeam === getPlayerInfo(ACTIVE_PLAYER as number)?.team) {
        roundBanner.classList.add('won');
        playSound('round_win');
    } else {
        roundBanner.classList.add('lost');
        playSound('round_lose');
    }

    setTimeout(() => roundBanner.classList.remove('active'), getConfig().match.roundIntermission - 500);
}

/**
 * Match end overlay is similar to round end banner but with more info and a return to menu button.
 * It stays until the player clicks the button, so no auto-hide timeout.
 */
export function hideMatchEndOverlay() {
    matchEndOverlay.classList.remove('active');
}

/**
 * Shows the match end overlay with the winning team and team scores.
 * @param winningTeam The team that won the match.
 * @param teamWins A map of team IDs to their respective win counts.
 */
function showMatchEndOverlay(winningTeam: number, teamWins: Record<number, number>) {
    const winnerEl = document.getElementById('match-end-winner')!;
    const scoreEl = document.getElementById('match-end-score')!;
    winnerEl.innerHTML = `Team ${winningTeam} wins the match!`;

    const winsArr = Object.entries(teamWins).map(([t, w]) => [Number(t), w] as [number, number]).sort((a, b) => a[0] - b[0]);
    scoreEl.innerHTML = winsArr.map(([t, w]) => `Team ${t}: ${w}`).join('<br />');

    if (winningTeam === getPlayerInfo(ACTIVE_PLAYER as number)?.team) {
        matchEndOverlay.classList.add('won');
        playSound('match_win');
    } else {
        matchEndOverlay.classList.add('lost');
        playSound('match_lose');
    }

    matchEndOverlay.classList.add('active');
}

/**
 * Renders the leaderboard by fetching all player states and info.
 * Grouping them by team, sorting teams and players by points, and then creating table rows for each player with their rank, name, points, kills, and deaths.
 * The local player is highlighted in the leaderboard.
 * @returns void
 */
function renderLeaderboard() {
    const states = getAdapter().getAllPlayerStates();
    const players = getAllPlayers();

    // Group by team, sort teams by total points, players within each team by points
    const teamMap = new Map<number, { state: PlayerGameState; info: player_info | undefined }[]>();
    for (const state of states) {
        const info = players.find((p) => p.id === state.playerId);
        const team = info?.team ?? 0;
        if (!teamMap.has(team)) teamMap.set(team, []);
        teamMap.get(team)!.push({ state, info });
    }

    const sortedTeams = Array.from(teamMap.entries()).sort((a, b) => {
        const aTotal = a[1].reduce((s, p) => s + p.state.points, 0);
        const bTotal = b[1].reduce((s, p) => s + p.state.points, 0);
        return bTotal - aTotal;
    });

    leaderboardBody.innerHTML = '';
    let rank = 1;
    let first = true;
    for (const [team, members] of sortedTeams) {
        if (!first) {
            const sep = document.createElement('tr');
            sep.classList.add('lb-team-separator');
            sep.innerHTML = '<td colspan="5"></td>';
            leaderboardBody.appendChild(sep);
        }
        first = false;
        members.sort((a, b) => b.state.points - a.state.points);
        for (const { state, info } of members) {
            const name = info?.name ?? `Player${state.playerId}`;
            const isLocal = state.playerId === ACTIVE_PLAYER;

            const row = document.createElement('tr');
            row.classList.add(`lb-team-${team}`);
            if (isLocal) row.classList.add('lb-local');
            row.innerHTML = `
                <td>${rank++}</td>
                <td>${name}</td>
                <td>${state.points}</td>
                <td>${state.kills}</td>
                <td>${state.deaths}</td>
            `;
            leaderboardBody.appendChild(row);
        }
    }
}

/**
 * Spawns a floating damage number at the specified world coordinates.
 * @param worldX The X coordinate in the game world.
 * @param worldY The Y coordinate in the game world.
 * @param damage The amount of damage dealt.
 * @param isKill Whether the damage resulted in a kill.
 */
export function spawnDamageNumber(worldX: number, worldY: number, damage: number, isKill: boolean) {
    const el = document.createElement('div');
    el.classList.add('damage-number');

    if (isKill) el.classList.add('kill');
    el.textContent = isKill ? `${damage} 💀` : `${damage}`;
    el.style.transform = cssTransform(worldX, worldY);

    const app = document.getElementById('app');
    if (app) {
        app.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
}
