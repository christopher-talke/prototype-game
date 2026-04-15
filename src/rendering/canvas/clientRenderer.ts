/**
 * PixiJS ClientRenderer -- subscribes to the GameEvent stream and translates
 * simulation events into PixiJS display mutations and audio triggers. No
 * simulation state is mutated here; this is purely a visual/audio consumer.
 *
 * Part of the canvas rendering layer. The DOM renderer has a parallel
 * implementation; both are swappable at runtime via rendererSwitch.
 */

import { Graphics as PixiGraphics, Text, Ticker } from 'pixi.js';

import { SETTINGS } from '../../app';
import { HALF_HIT_BOX } from '../../constants';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import type { PlayerDamagedEvent, PlayerKilledEvent, PlayerRespawnEvent, BulletHitEvent, BulletSpawnEvent, BulletRemovedEvent, GrenadeSpawnEvent, GrenadeDetonateEvent, GrenadeRemovedEvent, SmokeDeployEvent, PlayerStatusChangedEvent, FlashEffectEvent } from '@net/gameEvent';
import { ACTIVE_PLAYER } from '@simulation/player/playerRegistry';
import { getPlayerInfo } from '@simulation/player/playerRegistry';
import { clearPlayerElements } from '@rendering/playerElements';
import { PlayerStatus } from '@simulation/player/playerData';
import { getWeaponVfx, DEFAULT_WEAPON_VFX } from '@simulation/combat/weapons';
import { swapRemove } from './renderUtils';
import { damageNumberLayer, statusLabelLayer, explosionFxLayer } from './sceneGraph';
import { hudConfig } from './config/hudConfig';
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

/** A floating damage number animating upward from a hit location. */
type DamageNumber = { text: Text; elapsed: number };

/** A brief wall-impact spark spawned when a bullet is destroyed. */
type WallSpark = { g: PixiGraphics; elapsed: number; duration: number };

const activeWallSparks: WallSpark[] = [];

Ticker.shared.add((ticker) => {
    for (let i = activeWallSparks.length - 1; i >= 0; i--) {
        const s = activeWallSparks[i];
        s.elapsed += ticker.deltaMS;
        const t = Math.min(1, s.elapsed / s.duration);
        s.g.scale.set(DEFAULT_WEAPON_VFX.wallImpact.initialScale + (1 - DEFAULT_WEAPON_VFX.wallImpact.initialScale) * t);
        s.g.alpha = 1 - t;
        if (t >= 1) {
            s.g.destroy();
            swapRemove(activeWallSparks, i);
        }
    }
});

/**
 * Singleton PixiJS renderer that subscribes to gameEventBus and translates
 * simulation events into PixiJS display mutations, wall-impact sparks, damage
 * numbers, status labels, grenade effects, and smoke. Manages bullet graphics,
 * grenade sprites, and detonation deduplication across the canvas scene graph.
 */
class PixiClientRendererImpl {
    private initialized = false;
    private bulletGraphics = new Map<number, { graphic: PixiGraphics; poolIndex: number; weaponType?: string }>();
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

    /** Subscribes to the gameEventBus and starts the damage-number tick. Idempotent. */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        gameEventBus.subscribe((event) => this.handleEvent(event));
        Ticker.shared.add((ticker) => this.tickDamageNumbers(ticker.deltaMS));
    }

    /**
     * Per-frame update: repositions all bullet graphics, grenade sprites,
     * and status labels to match current simulation state.
     *
     * @param projectiles - Current projectile positions from the adapter
     * @param grenades - Current grenade positions and detonation flags from the adapter
     */
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
                entry.text.y = player.current_position.y + hudConfig.statusLabelYOffset;
            }
        }
    }

    /** Destroys all active visual elements and clears all effect systems. Called on round-end or renderer teardown. */
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

    /** Tears down all visuals and clears the player element registry. Called when reloading a map or switching renderers. */
    clearPlayers() {
        this.teardownVisuals();
        clearPlayerElements();
    }

    /**
     * Routes incoming GameEvents to the appropriate handler method.
     * No-ops if the active renderer is not 'pixi'.
     *
     * @param event - A GameEvent emitted by the simulation layer
     */
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

    /**
     * Creates a floating damage number Text object at world position (x, y).
     * Kill shots use a larger bold font. The number floats upward and fades
     * out over hudConfig.damageNumberDuration ms via tickDamageNumbers.
     *
     * @param x - World X coordinate of the hit
     * @param y - World Y coordinate of the hit
     * @param damage - Damage dealt to display
     * @param isKill - Whether this hit killed the target; affects font size and colour
     */
    private spawnDamageNumber(x: number, y: number, damage: number, isKill: boolean) {
        const t = new Text({
            text: isKill ? `${damage} X` : `${damage}`,
            style: {
                fontFamily: 'Courier New',
                fontSize: isKill ? hudConfig.damageNumberKillFontSize : hudConfig.damageNumberNormalFontSize,
                fill: isKill ? hudConfig.damageNumberKillColor : hudConfig.damageNumberNormalColor,
                fontWeight: isKill ? 'bold' : 'normal',
            },
        });
        t.anchor.set(0.5, 1);
        t.x = x;
        t.y = y;
        damageNumberLayer.addChild(t);
        this.activeDamageNumbers.push({ text: t, elapsed: 0 });
    }

    /**
     * Advances all active damage number animations. Floats each number upward
     * and fades it out; destroys and removes entries whose animation is complete.
     *
     * @param deltaMS - Elapsed milliseconds since the last frame
     */
    private tickDamageNumbers(deltaMS: number) {
        for (let i = this.activeDamageNumbers.length - 1; i >= 0; i--) {
            const entry = this.activeDamageNumbers[i];
            entry.elapsed += deltaMS;
            const t = Math.min(1, entry.elapsed / hudConfig.damageNumberDuration);
            entry.text.y -= deltaMS * hudConfig.damageNumberFloatSpeed;
            entry.text.alpha = 1 - t;
            if (t >= 1) {
                entry.text.destroy();
                swapRemove(this.activeDamageNumbers, i);
            }
        }
    }

    private onSmokeDeploy(event: SmokeDeployEvent) {
        spawnSmokeCloud(event.x, event.y, event.radius, event.duration);
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

    /**
     * Replaces any existing status label for the player with a new PixiJS Text
     * node at the player's world position. Non-buying statuses auto-dismiss
     * after a timeout; BUYING labels persist until explicitly cleared.
     *
     * @param event - The PLAYER_STATUS_CHANGED event from the simulation
     */
    private onPlayerStatusChanged(event: PlayerStatusChangedEvent) {
        this.removeStatusLabel(event.playerId);
        const displayText = PixiClientRendererImpl.STATUS_DISPLAY[event.status];
        if (!displayText) return;
        const player = getPlayerInfo(event.playerId);
        if (!player) return;

        const t = new Text({
            text: displayText,
            style: { fontFamily: 'Courier New', fontSize: hudConfig.statusLabelFontSize, fill: hudConfig.statusLabelColor },
        });
        t.anchor.set(0.5, 1);
        t.x = player.current_position.x + HALF_HIT_BOX;
        t.y = player.current_position.y + hudConfig.statusLabelYOffset;
        statusLabelLayer.addChild(t);

        let timer: ReturnType<typeof setTimeout> | null = null;
        if (event.status !== PlayerStatus.BUYING) {
            const duration = event.status === PlayerStatus.DEAD ? hudConfig.statusLabelDeadTimeout : hudConfig.statusLabelDefaultTimeout;
            timer = setTimeout(() => this.removeStatusLabel(event.playerId), duration);
        }
        this.statusLabels.set(event.playerId, { text: t, timer });
    }

    /**
     * Registers the bullet's direction for smoke wake turbulence, then acquires
     * a pooled PixiJS projectile graphic and positions it at the spawn point.
     *
     * @param event - The BULLET_SPAWN event from the simulation
     */
    private onBulletSpawn(event: BulletSpawnEvent) {
        // Track bullet direction for smoke wake turbulence
        trackBulletDirection(event.bulletId, event.dx, event.dy);

        if (!event.weaponType) return;
        const acquired = acquirePixiProjectile(event.weaponType);
        if (acquired) {
            acquired.graphic.x = event.x;
            acquired.graphic.y = event.y;
            this.bulletGraphics.set(event.bulletId, { ...acquired, weaponType: event.weaponType });
        }
    }

    /**
     * Releases the bullet graphic back to the pool and spawns a wall-impact
     * spark at the bullet's last known position using weapon VFX config.
     *
     * @param event - The BULLET_REMOVED event from the simulation
     */
    private onBulletRemoved(event: BulletRemovedEvent) {
        removeBulletDirection(event.bulletId);

        const entry = this.bulletGraphics.get(event.bulletId);
        if (entry) {
            const wi = getWeaponVfx(entry.weaponType).wallImpact;
            // Spawn wall-hit spark at bullet's last position
            const spark = new PixiGraphics();
            spark.circle(0, 0, wi.outerRadius).fill({ color: wi.outerColor, alpha: wi.outerAlpha });
            spark.circle(0, 0, wi.innerRadius).fill({ color: wi.innerColor, alpha: wi.innerAlpha });
            spark.x = entry.graphic.x;
            spark.y = entry.graphic.y;
            spark.scale.set(wi.initialScale);
            spark.blendMode = wi.blendMode as any;
            explosionFxLayer.addChild(spark);
            activeWallSparks.push({ g: spark, elapsed: 0, duration: wi.duration });

            releasePixiProjectile(entry.poolIndex);
            this.bulletGraphics.delete(event.bulletId);
        }
    }

    private onGrenadeSpawn(event: GrenadeSpawnEvent) {
        onPixiGrenadeSpawn(event.grenadeId, event.grenadeType, event.x, event.y, event.isC4);
    }

    /**
     * Routes a grenade detonation to the appropriate effect module (fragEffect,
     * c4Effect). Guards against duplicate detonation events via detonatedGrenades
     * set. FLASH and SMOKE visuals are driven by separate events.
     *
     * @param event - The GRENADE_DETONATE event from the simulation
     */
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
