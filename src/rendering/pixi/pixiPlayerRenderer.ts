import { Container, Graphics, Sprite, Text, Texture, Ticker } from 'pixi.js';
import { HALF_HIT_BOX } from '../../constants';
import { ACTIVE_PLAYER, addPlayer, getAllPlayers, getPlayerInfo } from '@simulation/player/playerRegistry';
import { playerLayer, healthBarLayer, nametagLayer, corpseLayer, lastKnownLayer } from './pixiSceneGraph';
import { getConfig } from '@config/activeConfig';
import { getActiveWeapon } from '@simulation/combat/shooting';
import type { LOSResult } from '@simulation/player/visibility';

const TEAM_COLORS: Record<number, number> = {
    1: 0x00e5ff,
    2: 0xff4757,
    3: 0xffa502,
    4: 0x7bed9f,
};

const RADIUS = 21;
const HIT_COLOR = 0xff943c;
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
}

const pixiPlayers = new Map<number, PlayerEntry>();
const healthBarTimers = new Map<number, ReturnType<typeof setTimeout>>();
const corpseList: { g: Container; timer: ReturnType<typeof setTimeout> }[] = [];

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
            lastKnownFading.splice(i, 1);
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
    container.x = pos.x + HALF_HIT_BOX;
    container.y = pos.y + HALF_HIT_BOX;
    container.rotation = (pos.rotation * Math.PI) / 180;

    const body = new Graphics();
    body.circle(0, 0, RADIUS).fill({ color, alpha: 0.15 });
    body.circle(0, 0, RADIUS).stroke({ color, width: 2 });

    const dirIndicator = new Graphics();
    dirIndicator.rect(-1, -(RADIUS + 5), 2, 8).fill({ color });

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
    healthGroup.x = pos.x;
    healthGroup.y = pos.y - 12;
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
            style: { fontFamily: 'Courier New', fontSize: 13, fill: 0xdddddd, align: 'center' },
        });
        nameTag.anchor.set(0.5, 1);
        nameTag.x = pos.x + HALF_HIT_BOX;
        nameTag.y = pos.y - 14;
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
    });
}

function redrawBars(healthBar: Graphics, armorBar: Graphics, health: number, armour: number) {
    const hw = Math.max(0, health / 100) * BAR_WIDTH;
    const aw = Math.max(0, armour / 100) * BAR_WIDTH;
    healthBar.clear();
    if (hw > 0) healthBar.rect(0, BAR_HEIGHT + 2, hw, BAR_HEIGHT).fill(HEALTH_COLOR);
    armorBar.clear();
    if (aw > 0) armorBar.rect(0, 0, aw, BAR_HEIGHT).fill(ARMOR_COLOR);
}

export function applyPixiVisibility(result: LOSResult, targetId: number) {
    if (!result.stateChanged) return;
    const entry = pixiPlayers.get(targetId);
    if (!entry) return;

    if (result.canSee) {
        entry.container.alpha = 1;
        entry.body.visible = true;
        entry.dirIndicator.visible = true;
        entry.sameTeamSquare.visible = false;
        if (entry.weaponIcon) entry.weaponIcon.visible = entry.lastWeaponType !== null;
    } else if (result.sameTeam) {
        entry.container.alpha = 1;
        entry.body.visible = false;
        entry.dirIndicator.visible = false;
        entry.sameTeamSquare.visible = true;
        if (entry.weaponIcon) entry.weaponIcon.visible = false;
    } else {
        entry.container.alpha = 0;
        entry.body.visible = true;
        entry.dirIndicator.visible = true;
        entry.sameTeamSquare.visible = false;
        if (entry.weaponIcon) entry.weaponIcon.visible = false;
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
        entry.container.x = pos.x + HALF_HIT_BOX;
        entry.container.y = pos.y + HALF_HIT_BOX;
        entry.container.rotation = (pos.rotation * Math.PI) / 180;
        entry.healthGroup.x = pos.x;
        entry.healthGroup.y = pos.y - 12;
        if (entry.nameTag) {
            entry.nameTag.x = pos.x + HALF_HIT_BOX;
            entry.nameTag.y = pos.y - 14;
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
    redrawBars(entry.healthBar, entry.armorBar, health, armour);
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

    const corpseContainer = new Container();
    const circle = new Graphics();
    circle.circle(0, 0, RADIUS).fill({ color, alpha: 0.1 });
    circle.circle(0, 0, RADIUS).stroke({ color, width: 2 });
    corpseContainer.addChild(circle);

    const skull = new Text({
        text: '\u2620',
        style: { fontFamily: 'Arial', fontSize: 16, fill: 0xffffff },
    });
    skull.anchor.set(0.5, 0.5);
    corpseContainer.addChild(skull);

    corpseContainer.x = playerInfo.current_position.x + HALF_HIT_BOX;
    corpseContainer.y = playerInfo.current_position.y + HALF_HIT_BOX;
    corpseLayer.addChild(corpseContainer);

    const timer = setTimeout(() => {
        corpseContainer.destroy({ children: true });
        const idx = corpseList.findIndex((c) => c.g === corpseContainer);
        if (idx !== -1) corpseList.splice(idx, 1);
    }, 5000);
    corpseList.push({ g: corpseContainer, timer });
}

export function onPixiPlayerRespawn(playerId: number, x: number, y: number, rotation: number) {
    const entry = pixiPlayers.get(playerId);
    if (!entry) return;

    entry.container.visible = true;
    entry.container.x = x + HALF_HIT_BOX;
    entry.container.y = y + HALF_HIT_BOX;
    entry.container.rotation = (rotation * Math.PI) / 180;
    entry.body.visible = true;
    entry.dirIndicator.visible = true;
    entry.sameTeamSquare.visible = false;

    if (playerId === ACTIVE_PLAYER) {
        entry.container.alpha = 1;
        if (entry.weaponIcon) entry.weaponIcon.visible = entry.lastWeaponType !== null;
    }

    const playerInfo = getPlayerInfo(playerId);
    if (playerInfo) redrawBars(entry.healthBar, entry.armorBar, playerInfo.health, playerInfo.armour);
}

export function onPixiRoundStart() {
    for (const { g, timer } of corpseList) {
        clearTimeout(timer);
        g.destroy({ children: true });
    }
    corpseList.length = 0;
}

export function clearPixiPlayers() {
    for (const [, entry] of pixiPlayers) {
        entry.container.destroy({ children: true });
        entry.healthGroup.destroy({ children: true });
        if (entry.nameTag) entry.nameTag.destroy();
    }
    pixiPlayers.clear();
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
