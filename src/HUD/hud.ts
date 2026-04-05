import './hud.css';
import { getWeaponDef, WEAPON_DEFS } from '../Combat/weapons';
import { getActiveWeapon } from '../Combat/shooting';
import { buyWeapon, getPlayerState } from '../Combat/gameState';
import { isPlayerDead } from '../Combat/damage';

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

    // Score
    const score = document.createElement('div');
    score.id = 'hud-score';
    score.textContent = 'K: 0 / D: 0';
    container.appendChild(score);

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

    // Buy menu
    const bm = document.createElement('div');
    bm.id = 'hud-buymenu';
    bm.innerHTML = `<h3>BUY MENU [B to close]</h3><div class="buymenu-grid" id="buymenu-grid"></div>`;
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
    // deathText element exists in DOM but doesn't need a JS reference
}

export function updateHUD(playerInfo: player_info, timeRemaining: number) {
    const state = getPlayerState(playerInfo.id);
    if (!state) return;

    // Health bar
    const healthPct = Math.max(0, playerInfo.health);
    healthBar.style.width = `${healthPct}%`;
    if (healthPct > 50) {
        healthBar.style.background = '#4ade80';
    } else if (healthPct > 25) {
        healthBar.style.background = '#fbbf24';
    } else {
        healthBar.style.background = '#ef4444';
    }

    // Armor bar
    armorBar.style.width = `${Math.max(0, playerInfo.armour)}%`;

    // Ammo
    const weapon = getActiveWeapon(playerInfo);
    if (weapon) {
        const wDef = getWeaponDef(weapon.type);
        weaponName.textContent = wDef.name;
        ammoCount.textContent = `${weapon.ammo}`;
        ammoMax.textContent = `/ ${weapon.maxAmmo}`;
        reloadText.style.display = weapon.reloading ? 'block' : 'none';
        crosshair.dataset.weapon = weapon.type;
    }

    // Money
    moneyDisplay.textContent = `$${state.money}`;

    // Timer
    const totalSecs = Math.ceil(timeRemaining / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Score
    scoreDisplay.textContent = `K: ${state.kills} / D: ${state.deaths}`;

    // Death overlay
    if (isPlayerDead(playerInfo)) {
        deathOverlay.classList.add('active');
    } else {
        deathOverlay.classList.remove('active');
    }
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
    } else {
        buyMenu.classList.remove('open');
    }
}

export function isBuyMenuOpen(): boolean {
    return buyMenuOpen;
}

export function closeBuyMenu() {
    buyMenuOpen = false;
    buyMenu.classList.remove('open');
}

function renderBuyMenu(playerInfo: player_info) {
    const state = getPlayerState(playerInfo.id);
    if (!state) return;

    buyMenuGrid.innerHTML = '';

    Object.values(WEAPON_DEFS).forEach(wDef => {
        if (wDef.price === 0) return; // Don't show pistol (free)

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
                buyWeapon(playerInfo.id, wDef.id, playerInfo);
                renderBuyMenu(playerInfo); // Re-render to update money
            }
        });

        buyMenuGrid.appendChild(item);
    });
}

let damageIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;

export function showDamageIndicator(angleDeg: number) {
    const el = document.getElementById('hud-damage-indicator');
    if (!el) return;

    // Rotate the gradient to face direction of incoming damage
    el.style.setProperty('--dmg-angle', `${angleDeg}deg`);
    el.classList.remove('active');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('active');

    if (damageIndicatorTimeout) clearTimeout(damageIndicatorTimeout);
    damageIndicatorTimeout = setTimeout(() => {
        el.classList.remove('active');
    }, 600);
}

export function updateCrosshairPosition(x: number, y: number) {
    crosshair.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
}

let hitMarkerTimeout: ReturnType<typeof setTimeout> | null = null;

export function showHitMarker(isKill: boolean) {
    crosshair.classList.remove('hit', 'kill');
    // Force reflow so animation restarts
    void crosshair.offsetWidth;
    crosshair.classList.add(isKill ? 'kill' : 'hit');
    if (hitMarkerTimeout) clearTimeout(hitMarkerTimeout);
    hitMarkerTimeout = setTimeout(() => {
        crosshair.classList.remove('hit', 'kill');
    }, 300);
}

export function spawnDamageNumber(worldX: number, worldY: number, damage: number, isKill: boolean) {
    const el = document.createElement('div');
    el.classList.add('damage-number');
    if (isKill) el.classList.add('kill');
    el.textContent = isKill ? `${damage} 💀` : `${damage}`;
    el.style.transform = `translate3d(${worldX}px, ${worldY}px, 0)`;
    // Import app lazily to avoid circular dep
    const app = document.getElementById('app');
    if (app) {
        app.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
}
