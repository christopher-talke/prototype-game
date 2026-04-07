// ClientRenderer: subscribes to GameEvent stream and handles all DOM/audio side effects.
// No state mutation happens here -- only visual/audio reactions to events.

import '../Combat/combat.css';
import '../Combat/grenade.css';
import { gameEventBus, type GameEvent } from './GameEvent';
import type { BulletSpawnEvent, BulletRemovedEvent, BulletHitEvent, PlayerDamagedEvent, PlayerKilledEvent, PlayerRespawnEvent, GrenadeSpawnEvent, GrenadeDetonateEvent, GrenadeBounceEvent, GrenadeRemovedEvent, ExplosionHitEvent, FlashEffectEvent, SmokeDeployEvent, KillFeedEvent, RoundEndEvent, ReloadStartEvent } from './GameEvent';
import { acquireProjectile, releaseProjectile } from '../Combat/ProjectilePool';
import { ACTIVE_PLAYER, getAllPlayers, getPlayerElement, getPlayerInfo, getHealthBarElement } from '../Globals/Players';
import { updateHealthBar, positionHealthBar } from '../Player/player';
import { removeLastKnownForPlayer } from '../Player/lineOfSight';
import { playSoundAtPlayer, playSound } from '../Audio/audio';
import { getWeaponSoundId, getWeaponReloadSoundId } from '../Audio/soundMap';
import { getActiveWeapon } from '../Combat/shooting';
import { getWeaponDef } from '../Combat/weapons';
import { showHitMarker, spawnDamageNumber, showDamageIndicator, addKillFeedEntry, showRoundEndBanner } from '../HUD/hud';
import { spawnSmoke } from '../Combat/smoke';
import { app } from '../Globals/App';
import { getConfig } from '../Config/activeConfig';
import { getAdapter } from './activeAdapter';

class ClientRendererImpl {
    private bulletElements = new Map<number, { element: HTMLElement; poolIndex: number }>();
    private grenadeElements = new Map<number, HTMLElement>();
    private healthBarTimers = new Map<number, ReturnType<typeof setTimeout>>();
    private corpseMarkers: { el: HTMLElement; timer: ReturnType<typeof setTimeout> }[] = [];
    private lastFireSoundTime = new Map<number, number>(); // ownerId -> timestamp (dedup for shotgun)
    private detonatedGrenades = new Set<number>(); // prevent duplicate detonation effects
    
    // Last written transform per remote player to skip redundant DOM writes
    private lastPlayerTransform = new Map<number, string>();
    private initialized = false;

    init() {
        if (this.initialized) return;
        this.initialized = true;
        gameEventBus.subscribe((event) => this.handleEvent(event));
    }

    private handleEvent(event: GameEvent) {
        switch (event.type) {
            case 'BULLET_SPAWN':
                this.onBulletSpawn(event);
                break;
            case 'BULLET_REMOVED':
                this.onBulletRemoved(event);
                break;
            case 'BULLET_HIT':
                this.onBulletHit(event);
                break;
            case 'PLAYER_DAMAGED':
                this.onPlayerDamaged(event);
                break;
            case 'PLAYER_KILLED':
                this.onPlayerKilled(event);
                break;
            case 'PLAYER_RESPAWN':
                this.onPlayerRespawn(event);
                break;
            case 'GRENADE_SPAWN':
                this.onGrenadeSpawn(event);
                break;
            case 'GRENADE_DETONATE':
                this.onGrenadeDetonate(event);
                break;
            case 'GRENADE_BOUNCE':
                this.onGrenadeBounce(event);
                break;
            case 'GRENADE_REMOVED':
                this.onGrenadeRemoved(event);
                break;
            case 'EXPLOSION_HIT':
                this.onExplosionHit(event);
                break;
            case 'FLASH_EFFECT':
                this.onFlashEffect(event);
                break;
            case 'SMOKE_DEPLOY':
                this.onSmokeDeploy(event);
                break;
            case 'KILL_FEED':
                this.onKillFeed(event);
                break;
            case 'ROUND_START':
                this.onRoundStart();
                break;
            case 'ROUND_END':
                this.onRoundEnd(event);
                break;
            case 'RELOAD_START':
                this.onReloadStart(event);
                break;
        }
    }

    // Called each frame after simulation tick to sync DOM positions
    updateVisuals() {
        const adapter = getAdapter();
        for (const p of adapter.getProjectiles()) {
            const entry = this.bulletElements.get(p.id);
            if (entry) {
                entry.element.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
            }
        }
        for (const g of adapter.getGrenades()) {
            const el = this.grenadeElements.get(g.id);
            if (el && !g.detonated) {
                el.style.transform = `translate3d(${Math.round(g.x)}px, ${Math.round(g.y)}px, 0)`;
            }
        }
        // Update remote player DOM elements -- only write transform when it changed
        for (const player of getAllPlayers()) {
            if (player.id === ACTIVE_PLAYER) continue;
            const el = getPlayerElement(player.id);
            if (el) {
                const pos = player.current_position;
                const transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${pos.rotation}deg)`;
                if (this.lastPlayerTransform.get(player.id) !== transform) {
                    this.lastPlayerTransform.set(player.id, transform);
                    el.style.transform = transform;
                    const hbEl = getHealthBarElement(player.id);
                    if (hbEl) positionHealthBar(hbEl, player);
                }
            }
        }
    }

    // -- Bullet rendering --

    private onBulletSpawn(event: BulletSpawnEvent) {
        // Skip rendering shrapnel bullets (no weaponType) - they're server-side damage mechanics
        if (!event.weaponType) return;

        const acquired = acquireProjectile(event.weaponType);
        if (acquired) {
            acquired.element.style.transform = `translate3d(${event.x}px, ${event.y}px, 0)`;
            this.bulletElements.set(event.bulletId, acquired);
        }

        // Play weapon fire sound (deduplicated for shotgun pellets)
        const now = performance.now();
        const lastSound = this.lastFireSoundTime.get(event.ownerId) ?? 0;
        if (now - lastSound > 30) {
            this.lastFireSoundTime.set(event.ownerId, now);
            const owner = getPlayerInfo(event.ownerId);
            if (owner && event.weaponType) {
                playSoundAtPlayer(getWeaponSoundId(event.weaponType), owner);

                // Mechanical sound (shotgun pump, sniper bolt)
                const weaponDef = getWeaponDef(event.weaponType);
                const weapon = getActiveWeapon(owner);
                if (weaponDef.mechanicalSound && weaponDef.mechanicalDelay && weapon && weapon.ammo > 0) {
                    const soundId = weaponDef.mechanicalSound;
                    setTimeout(() => playSoundAtPlayer(soundId, owner), weaponDef.mechanicalDelay);
                }
            }
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
                const angle = (Math.atan2(event.bulletDy, event.bulletDx) * 180) / Math.PI;
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
            this.corpseMarkers = this.corpseMarkers.filter((c) => c.el !== corpse);
        }, 5000);
        this.corpseMarkers.push({ el: corpse, timer: corpseTimer });

        removeLastKnownForPlayer(event.targetId);
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
        if (this.detonatedGrenades.has(event.grenadeId)) return;
        this.detonatedGrenades.add(event.grenadeId);

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

    // -- Reload --

    private onReloadStart(event: ReloadStartEvent) {
        const player = getPlayerInfo(event.playerId);
        if (!player) return;
        const weapon = getActiveWeapon(player);
        if (weapon) {
            playSoundAtPlayer(getWeaponReloadSoundId(weapon.type), player);
        }
    }

    // -- Match events --

    private onKillFeed(event: KillFeedEvent) {
        addKillFeedEntry(event.killerName, event.victimName, event.weaponType);
    }

    private onRoundEnd(event: RoundEndEvent) {
        showRoundEndBanner(event.winningTeam, event.teamWins, event.isFinal);
    }

    private onRoundStart() {
        for (const { el, timer } of this.corpseMarkers) {
            clearTimeout(timer);
            el.remove();
        }
        this.corpseMarkers.length = 0;
        this.detonatedGrenades.clear();
    }

    // -- Helpers --

    private showHealthBarTemporarily(playerId: number) {
        const wrap = getHealthBarElement(playerId);
        if (!wrap) return;
        wrap.classList.add('health-visible');
        const prev = this.healthBarTimers.get(playerId);
        if (prev) clearTimeout(prev);
        this.healthBarTimers.set(
            playerId,
            setTimeout(() => {
                wrap.classList.remove('health-visible');
                this.healthBarTimers.delete(playerId);
            }, getConfig().player.healthBarVisibleDuration),
        );
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
