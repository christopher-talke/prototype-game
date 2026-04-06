// ClientRenderer: subscribes to GameEvent stream and handles all DOM/audio side effects.
// No state mutation happens here -- only visual/audio reactions to events.

import '../Combat/combat.css';
import '../Combat/grenade.css';
import { gameEventBus, type GameEvent } from './GameEvent';
import type {
    BulletSpawnEvent, BulletRemovedEvent, BulletHitEvent,
    PlayerDamagedEvent, PlayerKilledEvent, PlayerRespawnEvent,
    GrenadeSpawnEvent, GrenadeDetonateEvent, GrenadeBounceEvent, GrenadeRemovedEvent,
    ExplosionHitEvent, FlashEffectEvent, SmokeDeployEvent,
} from './GameEvent';
import { simulation } from './GameSimulation';
import { acquireProjectile, releaseProjectile } from '../Combat/ProjectilePool';
import { ACTIVE_PLAYER, getPlayerElement, getPlayerInfo, getHealthBarElement } from '../Globals/Players';
import { updateHealthBar, positionHealthBar } from '../Player/player';
import { removeLastKnownForPlayer } from '../Player/lineOfSight';
import { recordKill } from '../Combat/gameState';
import { playSoundAtPlayer, playSound } from '../Audio/audio';
import { showHitMarker, spawnDamageNumber, showDamageIndicator } from '../HUD/hud';
import { spawnSmoke } from '../Combat/smoke';
import { app } from '../main';
import { getConfig } from '../Config/activeConfig';

class ClientRendererImpl {
    private bulletElements = new Map<number, { element: HTMLElement; poolIndex: number }>();
    private grenadeElements = new Map<number, HTMLElement>();
    private healthBarTimers = new Map<number, ReturnType<typeof setTimeout>>();
    private corpseMarkers: { el: HTMLElement; timer: ReturnType<typeof setTimeout> }[] = [];

    init() {
        gameEventBus.subscribe(event => this.handleEvent(event));
    }

    private handleEvent(event: GameEvent) {
        switch (event.type) {
            case 'BULLET_SPAWN': this.onBulletSpawn(event); break;
            case 'BULLET_REMOVED': this.onBulletRemoved(event); break;
            case 'BULLET_HIT': this.onBulletHit(event); break;
            case 'PLAYER_DAMAGED': this.onPlayerDamaged(event); break;
            case 'PLAYER_KILLED': this.onPlayerKilled(event); break;
            case 'PLAYER_RESPAWN': this.onPlayerRespawn(event); break;
            case 'GRENADE_SPAWN': this.onGrenadeSpawn(event); break;
            case 'GRENADE_DETONATE': this.onGrenadeDetonate(event); break;
            case 'GRENADE_BOUNCE': this.onGrenadeBounce(event); break;
            case 'GRENADE_REMOVED': this.onGrenadeRemoved(event); break;
            case 'EXPLOSION_HIT': this.onExplosionHit(event); break;
            case 'FLASH_EFFECT': this.onFlashEffect(event); break;
            case 'SMOKE_DEPLOY': this.onSmokeDeploy(event); break;
            case 'ROUND_START': this.onRoundStart(); break;
        }
    }

    // Called each frame after simulation tick to sync DOM positions
    updateVisuals() {
        for (const p of simulation.getProjectiles()) {
            const entry = this.bulletElements.get(p.id);
            if (entry) {
                entry.element.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
            }
        }
        for (const g of simulation.getGrenades()) {
            const el = this.grenadeElements.get(g.id);
            if (el && !g.detonated) {
                el.style.transform = `translate3d(${Math.round(g.x)}px, ${Math.round(g.y)}px, 0)`;
            }
        }
    }

    // -- Bullet rendering --

    private onBulletSpawn(event: BulletSpawnEvent) {
        const acquired = acquireProjectile(event.weaponType === 'SNIPER');
        if (acquired) {
            acquired.element.style.transform = `translate3d(${event.x}px, ${event.y}px, 0)`;
            this.bulletElements.set(event.bulletId, acquired);
        }
    }

    private onBulletRemoved(event: BulletRemovedEvent) {
        const entry = this.bulletElements.get(event.bulletId);
        if (entry) {
            releaseProjectile(entry.poolIndex);
            this.bulletElements.delete(event.bulletId);
        }
    }

    private onBulletHit(event: BulletHitEvent) {
        if (event.attackerId === ACTIVE_PLAYER) {
            showHitMarker(event.isKill, getPlayerInfo(event.targetId)?.name);
            spawnDamageNumber(event.x, event.y, event.damage, event.isKill);
        }
        if (event.targetId === ACTIVE_PLAYER) {
            const target = getPlayerInfo(event.targetId);
            if (target) {
                const angle = Math.atan2(event.bulletDy, event.bulletDx) * 180 / Math.PI;
                showDamageIndicator(angle, target.current_position.rotation);
            }
        }
        const el = getPlayerElement(event.targetId);
        if (el) {
            el.classList.add('hit-flash');
            setTimeout(() => el.classList.remove('hit-flash'), 150);
        }
    }

    // -- Player damage rendering --

    private onPlayerDamaged(event: PlayerDamagedEvent) {
        const target = getPlayerInfo(event.targetId);
        if (!target) return;
        if (target.health > 0) playSoundAtPlayer('hit', target);
        updateHealthBar(target);
        this.showHealthBarTemporarily(event.targetId);
    }

    private onPlayerKilled(event: PlayerKilledEvent) {
        const target = getPlayerInfo(event.targetId);
        if (!target) return;

        playSoundAtPlayer('death', target);

        const el = getPlayerElement(event.targetId);
        if (el) el.classList.add('dead');

        // Spawn a corpse marker at the death position
        const corpse = document.createElement('div');
        corpse.classList.add('corpse-marker', `team-${target.team}`);
        corpse.style.transform = `translate3d(${target.current_position.x}px, ${target.current_position.y}px, 0) rotate(${target.current_position.rotation}deg)`;
        app.appendChild(corpse);
        const corpseTimer = setTimeout(() => {
            corpse.remove();
            this.corpseMarkers = this.corpseMarkers.filter(c => c.el !== corpse);
        }, 5000);
        this.corpseMarkers.push({ el: corpse, timer: corpseTimer });

        removeLastKnownForPlayer(event.targetId);
        recordKill(event.killerId, event.targetId);

        setTimeout(() => {
            if (target.dead) {
                const events = simulation.respawnPlayer(target);
                gameEventBus.emitAll(events);
            }
        }, getConfig().player.respawnTime);
    }

    private onPlayerRespawn(event: PlayerRespawnEvent) {
        const target = getPlayerInfo(event.playerId);
        if (!target) return;

        const el = getPlayerElement(event.playerId);
        if (el) {
            el.classList.remove('dead');
            el.style.transform = `translate3d(${event.x}px, ${event.y}px, 0) rotate(${event.rotation}deg)`;
            if (event.playerId === ACTIVE_PLAYER) el.classList.add('visible');
        }

        const wrap = getHealthBarElement(event.playerId);
        if (wrap) positionHealthBar(wrap, target);
        updateHealthBar(target);
    }

    // -- Grenade rendering --

    private onGrenadeSpawn(event: GrenadeSpawnEvent) {
        const el = document.createElement('div');
        el.classList.add('grenade', `grenade-${event.grenadeType}`);
        if (event.isC4) el.classList.add('placed');
        el.style.transform = `translate3d(${event.x}px, ${event.y}px, 0)`;
        app.appendChild(el);
        this.grenadeElements.set(event.grenadeId, el);
        playSound('grenade_throw', { x: event.x, y: event.y });
    }

    private onGrenadeDetonate(event: GrenadeDetonateEvent) {
        switch (event.grenadeType) {
            case 'FRAG':
                this.spawnExplosionRing(event.x, event.y, event.radius, false);
                playSound('frag_explode', { x: event.x, y: event.y });
                break;
            case 'C4':
                this.spawnExplosionRing(event.x, event.y, event.radius, true);
                playSound('c4_explode', { x: event.x, y: event.y });
                break;
            case 'FLASH':
                playSound('flash_explode', { x: event.x, y: event.y });
                break;
        }
    }

    private onGrenadeBounce(event: GrenadeBounceEvent) {
        playSound('grenade_bounce', { x: event.x, y: event.y });
    }

    private onGrenadeRemoved(event: GrenadeRemovedEvent) {
        const el = this.grenadeElements.get(event.grenadeId);
        if (el) {
            el.remove();
            this.grenadeElements.delete(event.grenadeId);
        }
    }

    // -- Explosion / flash / smoke rendering --

    private onExplosionHit(event: ExplosionHitEvent) {
        if (event.attackerId === ACTIVE_PLAYER) {
            showHitMarker(event.isKill, getPlayerInfo(event.targetId)?.name);
            spawnDamageNumber(event.x, event.y, event.damage, event.isKill);
        }
    }

    private onFlashEffect(event: FlashEffectEvent) {
        if (event.targetId === ACTIVE_PLAYER) {
            this.showFlashOverlay(event.intensity, event.duration);
        }
    }

    private onSmokeDeploy(event: SmokeDeployEvent) {
        playSound('smoke_deploy', { x: event.x, y: event.y });
        spawnSmoke(event.x, event.y, event.radius, event.duration);
    }

    // -- Round events --

    private onRoundStart() {
        for (const { el, timer } of this.corpseMarkers) { clearTimeout(timer); el.remove(); }
        this.corpseMarkers.length = 0;
    }

    // -- Helpers --

    private showHealthBarTemporarily(playerId: number) {
        const wrap = getHealthBarElement(playerId);
        if (!wrap) return;
        wrap.classList.add('health-visible');
        const prev = this.healthBarTimers.get(playerId);
        if (prev) clearTimeout(prev);
        this.healthBarTimers.set(playerId, setTimeout(() => {
            wrap.classList.remove('health-visible');
            this.healthBarTimers.delete(playerId);
        }, getConfig().player.healthBarVisibleDuration));
    }

    private showFlashOverlay(intensity: number, duration: number) {
        const existing = document.querySelector('.flash-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.classList.add('flash-overlay');
        overlay.style.setProperty('--flash-intensity', `${intensity}`);
        overlay.style.setProperty('--flash-duration', `${duration}ms`);
        document.body.appendChild(overlay);

        void overlay.offsetWidth;
        overlay.classList.add('active');

        setTimeout(() => overlay.remove(), duration + 100);
    }

    private spawnExplosionRing(x: number, y: number, radius: number, isC4: boolean) {
        const ring = document.createElement('div');
        ring.classList.add('explosion-ring');
        if (isC4) ring.classList.add('c4');
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.style.width = `${radius * 2}px`;
        ring.style.height = `${radius * 2}px`;
        app.appendChild(ring);

        setTimeout(() => ring.remove(), 600);
    }
}

export const clientRenderer = new ClientRendererImpl();
