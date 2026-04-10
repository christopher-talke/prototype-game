import { SETTINGS } from '../../app';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import type { PlayerDamagedEvent, PlayerKilledEvent, PlayerRespawnEvent, BulletHitEvent } from '@net/gameEvent';
import {
    updatePixiPlayerVisuals,
    onPixiPlayerDamaged,
    onPixiPlayerKilled,
    onPixiPlayerHitFlash,
    onPixiPlayerRespawn,
    onPixiRoundStart,
    clearPixiPlayers,
} from './pixiPlayerRenderer';

class PixiClientRendererImpl {
    private initialized = false;

    init() {
        if (this.initialized) return;
        this.initialized = true;
        gameEventBus.subscribe((event) => this.handleEvent(event));
    }

    updateVisuals() {
        updatePixiPlayerVisuals();
    }

    clearPlayers() {
        clearPixiPlayers();
    }

    private handleEvent(event: GameEvent) {
        if (SETTINGS.renderer !== 'pixi') return;
        switch (event.type) {
            case 'PLAYER_DAMAGED': this.onPlayerDamaged(event); break;
            case 'PLAYER_KILLED': this.onPlayerKilled(event); break;
            case 'PLAYER_RESPAWN': this.onPlayerRespawn(event); break;
            case 'BULLET_HIT': this.onBulletHit(event); break;
            case 'ROUND_START': onPixiRoundStart(); break;
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
}

export const pixiClientRenderer = new PixiClientRendererImpl();
