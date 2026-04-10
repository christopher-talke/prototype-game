// ClientRenderer: subscribes to GameEvent stream and handles all DOM/audio side effects.
// No state mutation happens here -- only visual/audio reactions to events.

import { app } from '../../app';
import { HALF_HIT_BOX } from '../../constants';
import '@rendering/dom/css/combat.css';
import '@rendering/dom/css/grenade.css';

import { gameEventBus, type GameEvent } from '@net/gameEvent';
import type { BulletSpawnEvent, BulletRemovedEvent, BulletHitEvent, PlayerDamagedEvent, PlayerKilledEvent, PlayerRespawnEvent, GrenadeSpawnEvent, GrenadeDetonateEvent, GrenadeBounceEvent, GrenadeRemovedEvent, ExplosionHitEvent, FlashEffectEvent, SmokeDeployEvent, KillFeedEvent, RoundEndEvent, ReloadStartEvent, PlayerStatusChangedEvent, FootstepEvent } from '@net/gameEvent';
import { acquireProjectile, releaseProjectile } from '@simulation/combat/projectilePool';
import { ACTIVE_PLAYER, getAllPlayers, getPlayerInfo } from '@simulation/player/playerRegistry';
import { clearPlayerRegistry } from '@simulation/player/playerRegistry';
import { getPlayerElement, getHealthBarElement, getNametagElement, clearPlayerElements } from '@rendering/playerElements';
import { updateHealthBar, positionHealthBar, positionNametag } from '@rendering/dom/playerRenderer';
import { PlayerStatus } from '@simulation/player/playerData';
import { removeLastKnownForPlayer } from '@rendering/dom/visibilityRenderer';
import { playSoundAtPlayer, playSound, playFootstep } from '@audio/index';
import { getWeaponSoundId, getWeaponReloadSoundId } from '@audio/soundMap';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getWeaponDef } from '@simulation/combat/weapons';
import { showHitMarker, spawnDamageNumber, showDamageIndicator, addKillFeedEntry, showRoundEndBanner } from '@rendering/dom/hud';
import { addSmokeData } from '@simulation/combat/smokeData';
import { spawnSmokeCloud } from '@rendering/dom/smokeRenderer';
import { getConfig } from '@config/activeConfig';
import { getAdapter } from '@net/activeAdapter';
import { cssTransform } from '@rendering/dom/cssTransform';

class ClientRendererImpl {
    private bulletElements = new Map<number, { element: HTMLElement; poolIndex: number }>();
    private grenadeElements = new Map<number, HTMLElement>();
    private healthBarTimers = new Map<number, ReturnType<typeof setTimeout>>();
    private corpseMarkers: { el: HTMLElement; timer: ReturnType<typeof setTimeout> }[] = [];
    private lastFireSoundTime = new Map<number, number>(); // ownerId -> timestamp (dedup for shotgun)
    private detonatedGrenades = new Set<number>(); // prevent duplicate detonation effects

    // Last written transform per remote player to skip redundant DOM writes
    private lastPlayerTransform = new Map<number, string>();
    private statusLabels = new Map<number, { el: HTMLElement; timer: ReturnType<typeof setTimeout> | null }>();
    private lastWeaponType = new Map<number, string>();
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
            case 'PLAYER_STATUS_CHANGED':
                this.onPlayerStatusChanged(event);
                break;
            case 'FOOTSTEP':
                this.onFootstep(event);
                break;
        }
    }

    // Called each frame after simulation tick to sync DOM positions
    updateVisuals() {
        const adapter = getAdapter();
        for (const p of adapter.getProjectiles()) {
            const entry = this.bulletElements.get(p.id);
            if (entry) {
                entry.element.style.transform = cssTransform(Math.round(p.x), Math.round(p.y));
            }
        }
        for (const g of adapter.getGrenades()) {
            const el = this.grenadeElements.get(g.id);
            if (el && !g.detonated) {
                el.style.transform = cssTransform(Math.round(g.x), Math.round(g.y));
            }
        }
        // Update all player DOM elements -- only write transform when it changed
        for (const player of getAllPlayers()) {
            const el = getPlayerElement(player.id);
            if (el) {
                const pos = player.current_position;
                const transform = cssTransform(pos.x, pos.y, pos.rotation);
                if (this.lastPlayerTransform.get(player.id) !== transform) {
                    this.lastPlayerTransform.set(player.id, transform);
                    el.style.transform = transform;
                    const hbEl = getHealthBarElement(player.id);
                    if (hbEl) positionHealthBar(hbEl, player);
                    const ntEl = getNametagElement(player.id);
                    if (ntEl) positionNametag(ntEl, player);
                    const labelEntry = this.statusLabels.get(player.id);
                    if (labelEntry) {
                        labelEntry.el.style.transform = cssTransform(pos.x + HALF_HIT_BOX, pos.y - 52);
                    }
                }
                // Update weapon icon data attribute
                const activeWeapon = player.weapons.find(w => w.active);
                const weaponType = activeWeapon ? activeWeapon.type : '';
                if (this.lastWeaponType.get(player.id) !== weaponType) {
                    this.lastWeaponType.set(player.id, weaponType);
                    el.dataset.weapon = weaponType;
                }
                // Flip gun icon when facing left half (90-270) to avoid upside-down grip
                const rot = ((pos.rotation % 360) + 360) % 360;
                el.classList.toggle('weapon-flip', rot > 180 && rot < 360);
            }
        }
    }

    // -- Bullet rendering --

    private onBulletSpawn(event: BulletSpawnEvent) {
        // Skip rendering shrapnel bullets (no weaponType) - they're server-side damage mechanics
        if (!event.weaponType) return;

        const acquired = acquireProjectile(event.weaponType);
        if (acquired) {
            acquired.element.style.transform = cssTransform(event.x, event.y);
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
        if (app === undefined) return;

        const target = getPlayerInfo(event.targetId);
        if (!target) return;

        playSoundAtPlayer('death', target);

        const el = getPlayerElement(event.targetId);
        if (el) el.classList.add('dead');

        // Spawn a corpse marker at the death position
        const corpse = document.createElement('div');
        corpse.classList.add('corpse-marker', `team-${target.team}`);
        corpse.style.transform = cssTransform(target.current_position.x, target.current_position.y, target.current_position.rotation);
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
            el.style.transform = cssTransform(event.x, event.y, event.rotation);
            if (event.playerId === ACTIVE_PLAYER) el.classList.add('visible');
        }

        const wrap = getHealthBarElement(event.playerId);
        if (wrap) positionHealthBar(wrap, target);
        updateHealthBar(target);
    }

    // -- Grenade rendering --

    private onGrenadeSpawn(event: GrenadeSpawnEvent) {
        if (app === undefined) return;

        const el = document.createElement('div');
        el.classList.add('grenade', `grenade-${event.grenadeType}`);
        if (event.isC4) el.classList.add('placed');
        el.style.transform = cssTransform(event.x, event.y);
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
        addSmokeData(event.x, event.y, event.radius, event.duration);
        spawnSmokeCloud(event.x, event.y, event.radius, event.duration);
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
        for (const [id] of this.statusLabels) {
            this.removeStatusLabel(id);
        }
    }

    // -- Player status labels --

    private static readonly STATUS_DISPLAY: Partial<Record<PlayerStatus, string>> = {
        [PlayerStatus.RELOADING]: 'RELOADING',
        [PlayerStatus.BUYING]: 'BUYING',
        [PlayerStatus.THROWING_FRAG]: 'FRAG OUT',
        [PlayerStatus.THROWING_FLASH]: 'FLASH OUT',
        [PlayerStatus.THROWING_SMOKE]: 'SMOKE OUT',
        [PlayerStatus.PLACING_C4]: 'PLANTING C4',
        [PlayerStatus.DEAD]: 'DEAD',
    };

    private removeStatusLabel(playerId: number) {
        const existing = this.statusLabels.get(playerId);
        if (existing) {
            if (existing.timer) clearTimeout(existing.timer);
            existing.el.remove();
            this.statusLabels.delete(playerId);
        }
    }

    private onPlayerStatusChanged(event: PlayerStatusChangedEvent) {
        if (app === undefined) return;

        this.removeStatusLabel(event.playerId);

        const displayText = ClientRendererImpl.STATUS_DISPLAY[event.status];
        if (!displayText) return;

        const player = getPlayerInfo(event.playerId);
        if (!player) return;

        const label = document.createElement('div');
        label.classList.add('player-status-label');
        label.setAttribute('data-status', event.status);
        label.textContent = displayText;
        label.style.transform = cssTransform(
            player.current_position.x + HALF_HIT_BOX,
            player.current_position.y - 52,
        );
        app.appendChild(label);

        // BUYING persists until menu closes; DEAD gets longer display; others fade
        let timer: ReturnType<typeof setTimeout> | null = null;
        if (event.status !== PlayerStatus.BUYING) {
            const duration = event.status === PlayerStatus.DEAD ? 2000 : 1500;
            timer = setTimeout(() => this.removeStatusLabel(event.playerId), duration);
        }

        this.statusLabels.set(event.playerId, { el: label, timer });
    }

    // -- Footstep --

    private onFootstep(event: FootstepEvent) {
        const player = getPlayerInfo(event.playerId);
        if (player) playFootstep(player, event.timestamp);
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
        if (app === undefined) return;

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

    teardownVisuals() {
        if (app) {
            app.querySelectorAll('.wall, .player, .player-health-wrap, .player-nametag, .grenade, .projectile, .corpse-marker, .aim-line, .last-known-position, .player-status-label, .damage-number, .explosion-ring, .smoke-cloud').forEach(el => el.remove());
        }
        for (const [, entry] of this.bulletElements) releaseProjectile(entry.poolIndex);
        this.bulletElements.clear();
        for (const [, el] of this.grenadeElements) el.remove();
        this.grenadeElements.clear();
        for (const { el, timer } of this.corpseMarkers) {
            clearTimeout(timer);
            el.remove();
        }
        this.corpseMarkers.length = 0;
        for (const [, timer] of this.healthBarTimers) clearTimeout(timer);
        this.healthBarTimers.clear();
        for (const [id] of this.statusLabels) this.removeStatusLabel(id);
        this.lastPlayerTransform.clear();
        this.lastWeaponType.clear();
        this.detonatedGrenades.clear();
        clearPlayerElements();
    }

    // Remove all player and health bar DOM elements, then clear player data.
    clearPlayers() {
        for (const playerId of getAllPlayers().map(p => p.id)) {
            const el = getPlayerElement(playerId);
            if (el) el.remove();
            const hb = getHealthBarElement(playerId);
            if (hb) hb.remove();
            const nt = getNametagElement(playerId);
            if (nt) nt.remove();
            this.removeStatusLabel(playerId);
        }
        clearPlayerRegistry();
        clearPlayerElements();
        this.lastPlayerTransform.clear();
        this.lastWeaponType.clear();
    }
}

export const clientRenderer = new ClientRendererImpl();
