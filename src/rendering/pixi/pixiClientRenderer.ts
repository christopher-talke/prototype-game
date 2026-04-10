import { SETTINGS } from '../../app';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import type { PlayerDamagedEvent, PlayerKilledEvent, PlayerRespawnEvent, BulletHitEvent, BulletSpawnEvent, BulletRemovedEvent, GrenadeSpawnEvent, GrenadeDetonateEvent, GrenadeRemovedEvent } from '@net/gameEvent';
import { getAdapter } from '@net/activeAdapter';
import {
    updatePixiPlayerVisuals,
    onPixiPlayerDamaged,
    onPixiPlayerKilled,
    onPixiPlayerHitFlash,
    onPixiPlayerRespawn,
    onPixiRoundStart,
    clearPixiPlayers,
} from './pixiPlayerRenderer';
import { acquirePixiProjectile, releasePixiProjectile } from './pixiProjectilePool';
import {
    onPixiGrenadeSpawn,
    onPixiGrenadeDetonate,
    onPixiGrenadeRemoved,
    updatePixiGrenadePositions,
    clearPixiGrenades,
} from './pixiGrenadeRenderer';
import type { Graphics } from 'pixi.js';

class PixiClientRendererImpl {
    private initialized = false;
    private bulletGraphics = new Map<number, { graphic: Graphics; poolIndex: number }>();
    private detonatedGrenades = new Set<number>();

    init() {
        if (this.initialized) return;
        this.initialized = true;
        gameEventBus.subscribe((event) => this.handleEvent(event));
    }

    updateVisuals() {
        updatePixiPlayerVisuals();
        const adapter = getAdapter();
        for (const p of adapter.getProjectiles()) {
            const entry = this.bulletGraphics.get(p.id);
            if (entry) {
                entry.graphic.x = Math.round(p.x);
                entry.graphic.y = Math.round(p.y);
            }
        }
        updatePixiGrenadePositions(adapter.getGrenades());
    }

    clearPlayers() {
        clearPixiPlayers();
        for (const [, entry] of this.bulletGraphics) releasePixiProjectile(entry.poolIndex);
        this.bulletGraphics.clear();
        clearPixiGrenades();
        this.detonatedGrenades.clear();
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
    }

    private onBulletSpawn(event: BulletSpawnEvent) {
        if (!event.weaponType) return;
        const acquired = acquirePixiProjectile(event.weaponType);
        if (acquired) {
            acquired.graphic.x = event.x;
            acquired.graphic.y = event.y;
            this.bulletGraphics.set(event.bulletId, acquired);
        }
    }

    private onBulletRemoved(event: BulletRemovedEvent) {
        const entry = this.bulletGraphics.get(event.bulletId);
        if (entry) {
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
        onPixiGrenadeDetonate(event.grenadeId, event.grenadeType, event.x, event.y, event.radius);
    }

    private onGrenadeRemoved(event: GrenadeRemovedEvent) {
        onPixiGrenadeRemoved(event.grenadeId);
    }

    private onRoundStart() {
        onPixiRoundStart();
        this.detonatedGrenades.clear();
    }
}

export const pixiClientRenderer = new PixiClientRendererImpl();
