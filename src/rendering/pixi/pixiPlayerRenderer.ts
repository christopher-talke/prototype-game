import { Container, Graphics, Text, Ticker } from 'pixi.js';
import { HALF_HIT_BOX } from '../../constants';
import { ACTIVE_PLAYER, addPlayer, getAllPlayers, getPlayerInfo } from '@simulation/player/playerRegistry';
import { playerLayer, healthBarLayer, nametagLayer, corpseLayer } from './pixiSceneGraph';
import { getConfig } from '@config/activeConfig';
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
}

const pixiPlayers = new Map<number, PlayerEntry>();
const healthBarTimers = new Map<number, ReturnType<typeof setTimeout>>();
const corpseList: { g: Graphics; timer: ReturnType<typeof setTimeout> }[] = [];

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

    container.addChild(body);
    container.addChild(dirIndicator);
    container.addChild(sameTeamSquare);
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
    } else if (result.sameTeam) {
        entry.container.alpha = 1;
        entry.body.visible = false;
        entry.dirIndicator.visible = false;
        entry.sameTeamSquare.visible = true;
    } else {
        entry.container.alpha = 0;
        entry.body.visible = true;
        entry.dirIndicator.visible = true;
        entry.sameTeamSquare.visible = false;
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

    const playerInfo = getPlayerInfo(targetId);
    if (!playerInfo) return;

    const color = TEAM_COLORS[playerInfo.team] ?? 0xffffff;
    const corpse = new Graphics();
    corpse.circle(0, 0, RADIUS).fill({ color, alpha: 0.1 });
    corpse.circle(0, 0, RADIUS).stroke({ color, width: 2 });
    corpse.x = playerInfo.current_position.x + HALF_HIT_BOX;
    corpse.y = playerInfo.current_position.y + HALF_HIT_BOX;
    corpseLayer.addChild(corpse);

    const timer = setTimeout(() => {
        corpse.destroy();
        const idx = corpseList.findIndex((c) => c.g === corpse);
        if (idx !== -1) corpseList.splice(idx, 1);
    }, 5000);
    corpseList.push({ g: corpse, timer });
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

    if (playerId === ACTIVE_PLAYER) entry.container.alpha = 1;

    const playerInfo = getPlayerInfo(playerId);
    if (playerInfo) redrawBars(entry.healthBar, entry.armorBar, playerInfo.health, playerInfo.armour);
}

export function onPixiRoundStart() {
    for (const { g, timer } of corpseList) {
        clearTimeout(timer);
        g.destroy();
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
    onPixiRoundStart();
}
