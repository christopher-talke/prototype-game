import { Container, Graphics, Sprite, Text, Texture, Ticker } from 'pixi.js';
import { HALF_HIT_BOX } from '../../constants';
import { swapRemove } from './renderUtils';
import { ACTIVE_PLAYER, addPlayer, getAllPlayers, getPlayerInfo } from '@simulation/player/playerRegistry';
import { playerLayer, healthBarLayer, nametagLayer, corpseLayer, lastKnownLayer } from './sceneGraph';
import { getConfig } from '@config/activeConfig';
import { getActiveWeapon } from '@simulation/combat/shooting';
import type { LOSResult } from '@simulation/player/visibility';
import { TEAM_COLORS } from './teamColors';
import { onPlayerGlowCreated, clearPlayerGlows } from './playerGlowManager';
import { addLastKnownLight, removeLastKnownLight } from './lightingManager';

const RADIUS = 21;
const HIT_COLOR = 0xff943c;

const visibleEnemies = new Set<number>();
export function getVisibleEnemies(): ReadonlySet<number> { return visibleEnemies; }
const visibleTeammates = new Set<number>();
export function getVisibleTeammates(): ReadonlySet<number> { return visibleTeammates; }
const HEALTH_COLOR = 0x4ade80;
const ARMOR_COLOR = 0x60a5fa;
const BAR_WIDTH = 44;
const BAR_HEIGHT = 4;
const LAST_KNOWN_FADE_DURATION = 3000;

interface PlayerEntry {
    container: Container;
    body: Graphics;
    dirIndicator: Graphics;
    sameTeamSquare: Graphics;
    healthGroup: Container;
    healthBar: Graphics;
    armorBar: Graphics;
    nameTag: Text | null;
    hitFlashMs: number;
    weaponIcon: Sprite | null;
    lastWeaponType: string | null;
    lastHealth: number;
    lastArmour: number;
}

const pixiPlayers = new Map<number, PlayerEntry>();
const healthBarTimers = new Map<number, ReturnType<typeof setTimeout>>();
const corpseList: { g: Container; timer: ReturnType<typeof setTimeout> }[] = [];

const SHARD_COUNT = 28;
const SPARK_COUNT = 16;
const SHATTER_DURATION = 1400;

interface Particle {
    g: Graphics;
    vx: number;
    vy: number;
    rotSpeed: number;
    elapsed: number;
    duration: number;
}

const activeParticles: Particle[] = [];

Ticker.shared.add((ticker) => {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.elapsed += ticker.deltaMS;
        const t = Math.min(1, p.elapsed / p.duration);
        const dt = ticker.deltaMS / 16;
        p.g.x += p.vx * dt;
        p.g.y += p.vy * dt;
        p.g.rotation += p.rotSpeed * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        // Hold full brightness then fade fast at the end
        p.g.alpha = t < 0.4 ? 1 : 1 - ((t - 0.4) / 0.6) * ((t - 0.4) / 0.6);
        if (t >= 1) {
            p.g.destroy();
            swapRemove(activeParticles, i);
        }
    }
});

function spawnShatter(x: number, y: number, color: number) {
    // Angular shards - the main body fragments
    for (let i = 0; i < SHARD_COUNT; i++) {
        const angle = (Math.PI * 2 * i) / SHARD_COUNT + (Math.random() - 0.5) * 0.5;
        const speed = 3 + Math.random() * 5;
        const w = 3 + Math.random() * 6;
        const h = 2 + Math.random() * 4;

        const g = new Graphics();
        g.poly([-w / 2, -h / 2, w / 2, 0, -w / 2, h / 2]).fill({ color });
        g.x = x + Math.cos(angle) * (RADIUS * 0.5 * Math.random());
        g.y = y + Math.sin(angle) * (RADIUS * 0.5 * Math.random());
        g.rotation = angle;
        corpseLayer.addChild(g);

        activeParticles.push({
            g,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotSpeed: (Math.random() - 0.5) * 0.3,
            elapsed: 0,
            duration: SHATTER_DURATION * (0.7 + Math.random() * 0.3),
        });
    }

    // Bright sparks - small fast dots
    for (let i = 0; i < SPARK_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 6;

        const g = new Graphics();
        g.circle(0, 0, 1.5 + Math.random()).fill({ color: 0xffffff });
        g.x = x + (Math.random() - 0.5) * RADIUS;
        g.y = y + (Math.random() - 0.5) * RADIUS;
        corpseLayer.addChild(g);

        activeParticles.push({
            g,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotSpeed: 0,
            elapsed: 0,
            duration: 400 + Math.random() * 300,
        });
    }

    // Brief bright flash at center
    const flash = new Graphics();
    flash.circle(0, 0, RADIUS * 1.2).fill({ color, alpha: 0.5 });
    flash.x = x;
    flash.y = y;
    corpseLayer.addChild(flash);
    activeParticles.push({
        g: flash,
        vx: 0, vy: 0, rotSpeed: 0,
        elapsed: 0,
        duration: 250,
    });
}

type LastKnownEntry = { g: Graphics; fadeTimer: ReturnType<typeof setTimeout> | null };
const lastKnownMarkers = new Map<string, LastKnownEntry>();
const lastKnownFading: { g: Graphics; elapsed: number }[] = [];

const weaponTextureCache = new Map<string, Texture>();


async function loadWeaponTexture(weaponType: string): Promise<Texture | null> {
    const key = weaponType.toLowerCase();
    if (weaponTextureCache.has(key)) return weaponTextureCache.get(key)!;
    try {
        const url = `/icons/weapons/${key}.svg`;
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 32, 32);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(img, 0, 0, 32, 32);
        const texture = Texture.from(canvas);
        weaponTextureCache.set(key, texture);
        return texture;
    } catch {
        return null;
    }
}

let flashPhase = 0;

Ticker.shared.add((ticker) => {
    flashPhase += ticker.deltaMS;
    const flashAlpha = 0.5 + 0.5 * Math.cos((Math.PI / 1000) * flashPhase);

    for (const [, entry] of pixiPlayers) {
        if (entry.hitFlashMs > 0) {
            entry.hitFlashMs -= ticker.deltaMS;
            if (entry.hitFlashMs <= 0) {
                entry.hitFlashMs = 0;
                entry.body.tint = 0xffffff;
            }
        }
        if (entry.sameTeamSquare.visible) {
            entry.sameTeamSquare.alpha = flashAlpha;
        }
    }

    for (let i = lastKnownFading.length - 1; i >= 0; i--) {
        const fade = lastKnownFading[i];
        fade.elapsed += ticker.deltaMS;
        const t = Math.min(1, fade.elapsed / 500);
        fade.g.alpha = 0.6 * (1 - t);
        if (t >= 1) {
            fade.g.destroy();
            swapRemove(lastKnownFading, i);
        }
    }
});

export function createPixiPlayer(playerInfo: player_info, isControllable: boolean, localTeam?: number) {
    addPlayer(playerInfo);

    const team = playerInfo.team;
    const color = TEAM_COLORS[team] ?? 0xffffff;
    const pos = playerInfo.current_position;

    const container = new Container();
    container.label = `player-${playerInfo.id}`;
    container.cullable = true;
    container.x = Math.round(pos.x + HALF_HIT_BOX);
    container.y = Math.round(pos.y + HALF_HIT_BOX);
    container.rotation = (pos.rotation * Math.PI) / 180;

    const body = new Graphics();
    body.circle(0, 0, RADIUS).fill({ color, alpha: 0.12 });
    body.circle(0, 0, RADIUS * 0.6).fill({ color, alpha: 0.06 });
    body.circle(0, 0, RADIUS).stroke({ color, width: 2 });
    body.circle(0, 0, RADIUS * 0.6).stroke({ color, width: 1, alpha: 0.2 });

    const dirIndicator = new Graphics();
    dirIndicator.poly([-4, -(RADIUS + 2), 0, -(RADIUS + 10), 4, -(RADIUS + 2)]).fill({ color, alpha: 0.9 });

    const sameTeamSquare = new Graphics();
    sameTeamSquare.rect(-10, -10, 20, 20).fill({ color });
    sameTeamSquare.visible = false;

    const weaponIcon = new Sprite();
    weaponIcon.anchor.set(0.5, 0.5);
    weaponIcon.rotation = -Math.PI / 2;
    weaponIcon.tint = color;
    weaponIcon.visible = false;

    container.addChild(body);
    container.addChild(dirIndicator);
    container.addChild(sameTeamSquare);
    container.addChild(weaponIcon);
    playerLayer.addChild(container);

    container.alpha = playerInfo.id === ACTIVE_PLAYER ? 1 : 0;

    const healthGroup = new Container();
    healthGroup.cullable = true;
    healthGroup.x = Math.round(pos.x);
    healthGroup.y = Math.round(pos.y - 12);
    healthGroup.alpha = 0;

    const armorBar = new Graphics();
    const healthBar = new Graphics();
    redrawBars(healthBar, armorBar, playerInfo.health, playerInfo.armour);

    healthGroup.addChild(armorBar);
    healthGroup.addChild(healthBar);
    healthBarLayer.addChild(healthGroup);

    let nameTag: Text | null = null;
    const sameTeam = !isControllable && localTeam != null && localTeam === team;
    if (sameTeam) {
        nameTag = new Text({
            text: playerInfo.name,
            style: {
                fontFamily: 'Courier New',
                fontSize: 13,
                fill: 0xeeeeee,
                align: 'center',
                dropShadow: { color: 0x000000, alpha: 0.8, blur: 2, distance: 1 },
            },
        });
        nameTag.anchor.set(0.5, 1);
        nameTag.x = Math.round(pos.x + HALF_HIT_BOX);
        nameTag.y = Math.round(pos.y - 14);
        nametagLayer.addChild(nameTag);
    }

    pixiPlayers.set(playerInfo.id, {
        container,
        body,
        dirIndicator,
        sameTeamSquare,
        healthGroup,
        healthBar,
        armorBar,
        nameTag,
        hitFlashMs: 0,
        weaponIcon,
        lastWeaponType: null,
        lastHealth: playerInfo.health,
        lastArmour: playerInfo.armour,
    });

    onPlayerGlowCreated(playerInfo.id, playerInfo.team);
}

export function getPixiPlayerContainer(playerId: number): Container | null {
    return pixiPlayers.get(playerId)?.container ?? null;
}

function redrawHealthBar(bar: Graphics, health: number) {
    const hw = Math.max(0, health / 100) * BAR_WIDTH;
    bar.clear();
    bar.rect(0, BAR_HEIGHT + 2, BAR_WIDTH, BAR_HEIGHT).fill({ color: 0x000000, alpha: 0.5 });
    bar.rect(0, BAR_HEIGHT + 2, BAR_WIDTH, BAR_HEIGHT).stroke({ color: 0xffffff, width: 0.5, alpha: 0.15 });
    if (hw > 0) bar.rect(0, BAR_HEIGHT + 2, hw, BAR_HEIGHT).fill(HEALTH_COLOR);
}

function redrawArmorBar(bar: Graphics, armour: number) {
    const aw = Math.max(0, armour / 100) * BAR_WIDTH;
    bar.clear();
    bar.rect(0, 0, BAR_WIDTH, BAR_HEIGHT).fill({ color: 0x000000, alpha: 0.5 });
    bar.rect(0, 0, BAR_WIDTH, BAR_HEIGHT).stroke({ color: 0xffffff, width: 0.5, alpha: 0.15 });
    if (aw > 0) bar.rect(0, 0, aw, BAR_HEIGHT).fill(ARMOR_COLOR);
}

function redrawBars(healthBar: Graphics, armorBar: Graphics, health: number, armour: number) {
    redrawHealthBar(healthBar, health);
    redrawArmorBar(armorBar, armour);
}

export function applyPixiVisibility(result: LOSResult, targetId: number) {
    const playerInfo = getPlayerInfo(targetId);
    if (playerInfo?.dead) return;
    if (!result.stateChanged) return;
    const entry = pixiPlayers.get(targetId);
    if (!entry) return;

    if (result.canSee) {
        entry.container.visible = true;
        entry.container.alpha = 1;
        entry.body.visible = true;
        entry.dirIndicator.visible = true;
        entry.sameTeamSquare.visible = false;
        if (entry.weaponIcon) entry.weaponIcon.visible = entry.lastWeaponType !== null;
        if (result.sameTeam) {
            visibleTeammates.add(targetId);
        } else {
            visibleEnemies.add(targetId);
        }
    } else if (result.sameTeam) {
        entry.container.visible = true;
        entry.container.alpha = 1;
        entry.body.visible = false;
        entry.dirIndicator.visible = false;
        entry.sameTeamSquare.visible = true;
        if (entry.weaponIcon) entry.weaponIcon.visible = false;
        visibleTeammates.delete(targetId);
    } else {
        entry.container.visible = false;
        entry.container.alpha = 0;
        entry.sameTeamSquare.visible = false;
        if (entry.weaponIcon) entry.weaponIcon.visible = false;
        visibleEnemies.delete(targetId);
    }
}

export function updatePixiLastKnown(result: LOSResult, targetPlayer: player_info, sourcePlayer: player_info) {
    const key = `${sourcePlayer.id}-${targetPlayer.id}`;
    if (result.canSee) {
        if (result.isLocalView) removeLastKnownByKey(key);
    } else if (result.isLocalView && result.prevVisible && !targetPlayer.dead && !result.sameTeam) {
        showLastKnown(key, targetPlayer);
    }
}

function showLastKnown(key: string, targetPlayer: player_info) {
    const existing = lastKnownMarkers.get(key);
    if (existing) {
        if (existing.fadeTimer) clearTimeout(existing.fadeTimer);
        existing.g.destroy();
        lastKnownMarkers.delete(key);
    }

    const color = TEAM_COLORS[targetPlayer.team] ?? 0xffffff;
    const g = new Graphics();
    g.rect(0, 0, 20, 20).fill({ color });
    g.alpha = 0.6;
    g.x = targetPlayer.current_position.x + HALF_HIT_BOX - 10;
    g.y = targetPlayer.current_position.y + HALF_HIT_BOX - 10;
    lastKnownLayer.addChild(g);

    addLastKnownLight(key,
        targetPlayer.current_position.x + HALF_HIT_BOX,
        targetPlayer.current_position.y + HALF_HIT_BOX);

    const fadeTimer = setTimeout(() => {
        lastKnownMarkers.delete(key);
        lastKnownFading.push({ g, elapsed: 0 });
    }, LAST_KNOWN_FADE_DURATION);

    lastKnownMarkers.set(key, { g, fadeTimer });
}

function removeLastKnownByKey(key: string) {
    const existing = lastKnownMarkers.get(key);
    if (!existing) return;
    if (existing.fadeTimer) clearTimeout(existing.fadeTimer);
    existing.g.destroy();
    lastKnownMarkers.delete(key);
    removeLastKnownLight(key);
}

export function removePixiLastKnownForPlayer(targetId: number) {
    for (const key of [...lastKnownMarkers.keys()]) {
        if (key.endsWith(`-${targetId}`)) removeLastKnownByKey(key);
    }
}

export function updatePixiPlayerVisuals() {
    for (const player of getAllPlayers()) {
        const entry = pixiPlayers.get(player.id);
        if (!entry) continue;
        const pos = player.current_position;
        entry.container.x = Math.round(pos.x + HALF_HIT_BOX);
        entry.container.y = Math.round(pos.y + HALF_HIT_BOX);
        entry.container.rotation = (pos.rotation * Math.PI) / 180;
        entry.healthGroup.x = Math.round(pos.x);
        entry.healthGroup.y = Math.round(pos.y - 12);
        if (entry.nameTag) {
            entry.nameTag.x = Math.round(pos.x + HALF_HIT_BOX);
            entry.nameTag.y = Math.round(pos.y - 14);
        }

        const weapon = getActiveWeapon(player);
        const weaponType = weapon?.type?.toLowerCase() ?? null;
        if (entry.lastWeaponType !== weaponType) {
            entry.lastWeaponType = weaponType;
            if (weaponType && entry.weaponIcon) {
                loadWeaponTexture(weaponType).then(texture => {
                    if (!entry.weaponIcon || entry.weaponIcon.destroyed) return;
                    if (texture) {
                        entry.weaponIcon.texture = texture;
                        entry.weaponIcon.width = 27;
                        entry.weaponIcon.height = 27;
                        entry.weaponIcon.visible = entry.container.alpha > 0 && entry.body.visible;
                    }
                });
            } else if (entry.weaponIcon) {
                entry.weaponIcon.visible = false;
            }
        }

        if (entry.weaponIcon && entry.weaponIcon.visible) {
            entry.weaponIcon.scale.y = (pos.rotation > 180 && pos.rotation < 360) ? -Math.abs(entry.weaponIcon.scale.x) : Math.abs(entry.weaponIcon.scale.x);
        }
    }
}

export function onPixiPlayerDamaged(targetId: number, health: number, armour: number) {
    const entry = pixiPlayers.get(targetId);
    if (!entry) return;
    if (health !== entry.lastHealth) {
        redrawHealthBar(entry.healthBar, health);
        entry.lastHealth = health;
    }
    if (armour !== entry.lastArmour) {
        redrawArmorBar(entry.armorBar, armour);
        entry.lastArmour = armour;
    }
    showHealthBarTemporarily(targetId);
}

function showHealthBarTemporarily(playerId: number) {
    const entry = pixiPlayers.get(playerId);
    if (!entry) return;
    entry.healthGroup.alpha = 1;
    const prev = healthBarTimers.get(playerId);
    if (prev) clearTimeout(prev);
    const duration = getConfig().player.healthBarVisibleDuration;
    healthBarTimers.set(
        playerId,
        setTimeout(() => {
            const e = pixiPlayers.get(playerId);
            if (e) e.healthGroup.alpha = 0;
            healthBarTimers.delete(playerId);
        }, duration),
    );
}

export function onPixiPlayerHitFlash(targetId: number) {
    const entry = pixiPlayers.get(targetId);
    if (!entry) return;
    entry.body.tint = HIT_COLOR;
    entry.hitFlashMs = 150;
}

export function onPixiPlayerKilled(targetId: number) {
    const entry = pixiPlayers.get(targetId);
    if (!entry) return;

    entry.container.visible = false;
    entry.healthGroup.alpha = 0;
    const prev = healthBarTimers.get(targetId);
    if (prev) clearTimeout(prev);
    healthBarTimers.delete(targetId);

    removePixiLastKnownForPlayer(targetId);

    const playerInfo = getPlayerInfo(targetId);
    if (!playerInfo) return;

    const color = TEAM_COLORS[playerInfo.team] ?? 0xffffff;
    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;

    spawnShatter(cx, cy, color);
}

export function onPixiPlayerRespawn(playerId: number, x: number, y: number, rotation: number) {
    const entry = pixiPlayers.get(playerId);
    if (!entry) return;

    entry.container.visible = true;
    entry.container.x = Math.round(x + HALF_HIT_BOX);
    entry.container.y = Math.round(y + HALF_HIT_BOX);
    entry.container.rotation = (rotation * Math.PI) / 180;
    entry.body.visible = true;
    entry.dirIndicator.visible = true;
    entry.sameTeamSquare.visible = false;

    if (playerId === ACTIVE_PLAYER) {
        entry.container.alpha = 1;
        if (entry.weaponIcon) entry.weaponIcon.visible = entry.lastWeaponType !== null;
    }

    const playerInfo = getPlayerInfo(playerId);
    if (playerInfo) {
        redrawBars(entry.healthBar, entry.armorBar, playerInfo.health, playerInfo.armour);
        entry.lastHealth = playerInfo.health;
        entry.lastArmour = playerInfo.armour;
    }
}

export function onPixiRoundStart() {
    for (const { g, timer } of corpseList) {
        clearTimeout(timer);
        g.destroy({ children: true });
    }
    corpseList.length = 0;
    for (const p of activeParticles) p.g.destroy();
    activeParticles.length = 0;
}

export function clearPixiPlayers() {
    clearPlayerGlows();
    for (const [, entry] of pixiPlayers) {
        entry.container.destroy({ children: true });
        entry.healthGroup.destroy({ children: true });
        if (entry.nameTag) entry.nameTag.destroy();
    }
    pixiPlayers.clear();
    visibleEnemies.clear();
    visibleTeammates.clear();
    for (const [, timer] of healthBarTimers) clearTimeout(timer);
    healthBarTimers.clear();
    for (const entry of lastKnownMarkers.values()) {
        if (entry.fadeTimer) clearTimeout(entry.fadeTimer);
        entry.g.destroy();
    }
    lastKnownMarkers.clear();
    lastKnownFading.length = 0;
    onPixiRoundStart();
}
