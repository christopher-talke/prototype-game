import { SETTINGS } from '../../app';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import type { PlayerDamagedEvent, PlayerKilledEvent, PlayerRespawnEvent, BulletHitEvent, BulletSpawnEvent, BulletRemovedEvent, GrenadeSpawnEvent, GrenadeDetonateEvent, GrenadeRemovedEvent, SmokeDeployEvent, PlayerStatusChangedEvent, FlashEffectEvent } from '@net/gameEvent';
import { ACTIVE_PLAYER, clearPlayerRegistry } from '@simulation/player/playerRegistry';
import { getPlayerInfo } from '@simulation/player/playerRegistry';
import { clearPlayerElements } from '@rendering/playerElements';
import { PlayerStatus } from '@simulation/player/playerData';
import { HALF_HIT_BOX } from '../../constants';
import { WALL_SPARK_COLOR } from './renderConstants';
import { swapRemove } from './renderUtils';
import { Graphics as PixiGraphics, Text, Ticker } from 'pixi.js';
import { damageNumberLayer, statusLabelLayer, explosionFxLayer } from './sceneGraph';
import {
    updatePixiPlayerVisuals,
    onPixiPlayerDamaged,
    onPixiPlayerKilled,
    onPixiPlayerHitFlash,
    onPixiPlayerRespawn,
    onPixiRoundStart,
    clearPixiPlayers,
} from './playerRenderer';
import { acquirePixiProjectile, releasePixiProjectile } from './projectilePool';
import {
    onPixiGrenadeSpawn,
    onPixiGrenadeRemoved,
    updatePixiGrenadePositions,
    clearPixiGrenades,
} from './grenadeRenderer';
import { spawnFragExplosion, clearFragEffects } from './effects/fragEffect';
import { spawnC4Explosion, clearC4Effects } from './effects/c4Effect';
import { triggerFlashEffect, clearFlashEffect } from './effects/flashEffect';
import { spawnSmokeCloud, clearSmokeEffects, trackBulletDirection, removeBulletDirection } from './effects/smokeEffect';
import { addSmokeData } from '@simulation/combat/smokeData';

type DamageNumber = { text: Text; elapsed: number };
type WallSpark = { g: PixiGraphics; elapsed: number };

const WALL_SPARK_DURATION = 250;
const activeWallSparks: WallSpark[] = [];

Ticker.shared.add((ticker) => {
    for (let i = activeWallSparks.length - 1; i >= 0; i--) {
        const s = activeWallSparks[i];
        s.elapsed += ticker.deltaMS;
        const t = Math.min(1, s.elapsed / WALL_SPARK_DURATION);
        s.g.scale.set(0.2 + 0.8 * t);
        s.g.alpha = 1 - t;
        if (t >= 1) {
            s.g.destroy();
            swapRemove(activeWallSparks, i);
        }
    }
});

class PixiClientRendererImpl {
    private initialized = false;
    private bulletGraphics = new Map<number, { graphic: PixiGraphics; poolIndex: number }>();
    private detonatedGrenades = new Set<number>();
    private statusLabels = new Map<number, { text: Text; timer: ReturnType<typeof setTimeout> | null }>();
    private activeDamageNumbers: DamageNumber[] = [];

    private static readonly STATUS_DISPLAY: Partial<Record<PlayerStatus, string>> = {
        [PlayerStatus.RELOADING]: 'RELOADING',
        [PlayerStatus.BUYING]: 'BUYING',
        [PlayerStatus.THROWING_FRAG]: 'FRAG OUT',
        [PlayerStatus.THROWING_FLASH]: 'FLASH OUT',
        [PlayerStatus.THROWING_SMOKE]: 'SMOKE OUT',
        [PlayerStatus.PLACING_C4]: 'PLANTING C4',
        [PlayerStatus.DEAD]: 'DEAD',
    };

    init() {
        if (this.initialized) return;
        this.initialized = true;
        gameEventBus.subscribe((event) => this.handleEvent(event));
        Ticker.shared.add((ticker) => this.tickDamageNumbers(ticker.deltaMS));
    }

    updateVisuals(
        projectiles: readonly { id: number; x: number; y: number }[],
        grenades: readonly { id: number; x: number; y: number; detonated: boolean }[],
    ) {
        updatePixiPlayerVisuals();
        for (const p of projectiles) {
            const entry = this.bulletGraphics.get(p.id);
            if (entry) {
                entry.graphic.x = Math.round(p.x);
                entry.graphic.y = Math.round(p.y);
            }
        }
        updatePixiGrenadePositions(grenades);
        for (const [playerId, entry] of this.statusLabels) {
            const player = getPlayerInfo(playerId);
            if (player) {
                entry.text.x = player.current_position.x + HALF_HIT_BOX;
                entry.text.y = player.current_position.y - 52;
            }
        }
    }

    teardownVisuals() {
        clearPixiPlayers();
        for (const [, entry] of this.bulletGraphics) releasePixiProjectile(entry.poolIndex);
        this.bulletGraphics.clear();
        clearPixiGrenades();
        this.detonatedGrenades.clear();
        for (const [, entry] of this.statusLabels) {
            if (entry.timer) clearTimeout(entry.timer);
            entry.text.destroy();
        }
        this.statusLabels.clear();
        for (const dn of this.activeDamageNumbers) dn.text.destroy();
        this.activeDamageNumbers.length = 0;
        clearFragEffects();
        clearC4Effects();
        clearFlashEffect();
        clearSmokeEffects();
    }

    clearPlayers() {
        this.teardownVisuals();
        clearPlayerRegistry();
        clearPlayerElements();
    }

    private handleEvent(event: GameEvent) {
        if (SETTINGS.renderer !== 'pixi') return;
        switch (event.type) {
            case 'PLAYER_DAMAGED': this.onPlayerDamaged(event); break;
            case 'PLAYER_KILLED': this.onPlayerKilled(event); break;
            case 'PLAYER_RESPAWN': this.onPlayerRespawn(event); break;
            case 'BULLET_HIT': this.onBulletHit(event); break;
            case 'BULLET_SPAWN': this.onBulletSpawn(event); break;
            case 'BULLET_REMOVED': this.onBulletRemoved(event); break;
            case 'GRENADE_SPAWN': this.onGrenadeSpawn(event); break;
            case 'GRENADE_DETONATE': this.onGrenadeDetonate(event); break;
            case 'GRENADE_REMOVED': this.onGrenadeRemoved(event); break;
            case 'SMOKE_DEPLOY': this.onSmokeDeploy(event); break;
            case 'FLASH_EFFECT': this.onFlashEffect(event); break;
            case 'PLAYER_STATUS_CHANGED': this.onPlayerStatusChanged(event); break;
            case 'ROUND_START': this.onRoundStart(); break;
        }
    }

    private onPlayerDamaged(event: PlayerDamagedEvent) {
        onPixiPlayerDamaged(event.targetId, event.newHealth, event.newArmor);
    }

    private onPlayerKilled(event: PlayerKilledEvent) {
        onPixiPlayerKilled(event.targetId);
    }

    private onPlayerRespawn(event: PlayerRespawnEvent) {
        onPixiPlayerRespawn(event.playerId, event.x, event.y, event.rotation);
    }

    private onBulletHit(event: BulletHitEvent) {
        onPixiPlayerHitFlash(event.targetId);
        if (event.attackerId === ACTIVE_PLAYER) {
            this.spawnDamageNumber(event.x, event.y, event.damage, event.isKill);
        }
    }

    private spawnDamageNumber(x: number, y: number, damage: number, isKill: boolean) {
        const t = new Text({
            text: isKill ? `${damage} X` : `${damage}`,
            style: {
                fontFamily: 'Courier New',
                fontSize: isKill ? 18 : 14,
                fill: isKill ? 0xff4444 : 0xffffff,
                fontWeight: isKill ? 'bold' : 'normal',
            },
        });
        t.anchor.set(0.5, 1);
        t.x = x;
        t.y = y;
        damageNumberLayer.addChild(t);
        this.activeDamageNumbers.push({ text: t, elapsed: 0 });
    }

    private tickDamageNumbers(deltaMS: number) {
        for (let i = this.activeDamageNumbers.length - 1; i >= 0; i--) {
            const entry = this.activeDamageNumbers[i];
            entry.elapsed += deltaMS;
            const t = Math.min(1, entry.elapsed / 800);
            entry.text.y -= deltaMS * 0.04;
            entry.text.alpha = 1 - t;
            if (t >= 1) {
                entry.text.destroy();
                swapRemove(this.activeDamageNumbers, i);
            }
        }
    }

    private onSmokeDeploy(event: SmokeDeployEvent) {
        spawnSmokeCloud(event.x, event.y, event.radius, event.duration);
        addSmokeData(event.x, event.y, event.radius, event.duration);
    }

    private onFlashEffect(event: FlashEffectEvent) {
        if (event.targetId === ACTIVE_PLAYER) {
            triggerFlashEffect(event.intensity, event.duration);
        }
    }

    private removeStatusLabel(playerId: number) {
        const existing = this.statusLabels.get(playerId);
        if (existing) {
            if (existing.timer) clearTimeout(existing.timer);
            existing.text.destroy();
            this.statusLabels.delete(playerId);
        }
    }

    private onPlayerStatusChanged(event: PlayerStatusChangedEvent) {
        this.removeStatusLabel(event.playerId);
        const displayText = PixiClientRendererImpl.STATUS_DISPLAY[event.status];
        if (!displayText) return;
        const player = getPlayerInfo(event.playerId);
        if (!player) return;

        const t = new Text({
            text: displayText,
            style: { fontFamily: 'Courier New', fontSize: 12, fill: 0xdddddd },
        });
        t.anchor.set(0.5, 1);
        t.x = player.current_position.x + HALF_HIT_BOX;
        t.y = player.current_position.y - 52;
        statusLabelLayer.addChild(t);

        let timer: ReturnType<typeof setTimeout> | null = null;
        if (event.status !== PlayerStatus.BUYING) {
            const duration = event.status === PlayerStatus.DEAD ? 2000 : 1500;
            timer = setTimeout(() => this.removeStatusLabel(event.playerId), duration);
        }
        this.statusLabels.set(event.playerId, { text: t, timer });
    }

    private onBulletSpawn(event: BulletSpawnEvent) {
        // Track bullet direction for smoke wake turbulence
        trackBulletDirection(event.bulletId, event.dx, event.dy);

        if (!event.weaponType) return;
        const acquired = acquirePixiProjectile(event.weaponType);
        if (acquired) {
            acquired.graphic.x = event.x;
            acquired.graphic.y = event.y;
            this.bulletGraphics.set(event.bulletId, acquired);
        }
    }

    private onBulletRemoved(event: BulletRemovedEvent) {
        removeBulletDirection(event.bulletId);

        const entry = this.bulletGraphics.get(event.bulletId);
        if (entry) {
            // Spawn wall-hit spark at bullet's last position
            const spark = new PixiGraphics();
            spark.circle(0, 0, 18).fill({ color: WALL_SPARK_COLOR, alpha: 0.9 });
            spark.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.7 });
            spark.x = entry.graphic.x;
            spark.y = entry.graphic.y;
            spark.scale.set(0.2);
            spark.blendMode = 'add';
            explosionFxLayer.addChild(spark);
            activeWallSparks.push({ g: spark, elapsed: 0 });

            releasePixiProjectile(entry.poolIndex);
            this.bulletGraphics.delete(event.bulletId);
        }
    }

    private onGrenadeSpawn(event: GrenadeSpawnEvent) {
        onPixiGrenadeSpawn(event.grenadeId, event.grenadeType, event.x, event.y, event.isC4);
    }

    private onGrenadeDetonate(event: GrenadeDetonateEvent) {
        if (this.detonatedGrenades.has(event.grenadeId)) return;
        this.detonatedGrenades.add(event.grenadeId);

        // Remove the grenade sprite
        onPixiGrenadeRemoved(event.grenadeId);

        // Route to appropriate effect module
        switch (event.grenadeType) {
            case 'FRAG':
                spawnFragExplosion(event.x, event.y, event.radius);
                break;
            case 'C4':
                spawnC4Explosion(event.x, event.y, event.radius);
                break;
            // FLASH and SMOKE detonation visuals are handled by their respective events
            // (FLASH_EFFECT and SMOKE_DEPLOY) which fire separately after GRENADE_DETONATE
        }
    }

    private onGrenadeRemoved(event: GrenadeRemovedEvent) {
        onPixiGrenadeRemoved(event.grenadeId);
    }

    private onRoundStart() {
        onPixiRoundStart();
        this.detonatedGrenades.clear();
        for (const [id] of this.statusLabels) this.removeStatusLabel(id);
        for (const s of activeWallSparks) s.g.destroy();
        activeWallSparks.length = 0;
        clearFragEffects();
        clearC4Effects();
        clearFlashEffect();
        clearSmokeEffects();
    }
}

export const pixiClientRenderer = new PixiClientRendererImpl();
