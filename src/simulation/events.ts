/**
 * Event and input type definitions for the simulation boundary.
 * GameEvent types are produced by the simulation; PlayerInput types are consumed by it.
 * The EventBus runtime lives in net/gameEvent.ts; this file is types only.
 */

import { PlayerStatus } from '@simulation/player/playerData';

/**
 * Discriminated union of all events emitted by the simulation layer.
 * Consumed by rendering, UI, net, and orchestration layers via the EventBus.
 */
export type GameEvent =
    | BulletSpawnEvent
    | BulletRemovedEvent
    | BulletHitEvent
    | PlayerDamagedEvent
    | PlayerKilledEvent
    | PlayerRespawnEvent
    | GrenadeSpawnEvent
    | GrenadeDetonateEvent
    | GrenadeBounceEvent
    | GrenadeRemovedEvent
    | ExplosionHitEvent
    | FlashEffectEvent
    | SmokeDeployEvent
    | KillFeedEvent
    | RoundStartEvent
    | RoundEndEvent
    | ReloadStartEvent
    | ReloadCompleteEvent
    | PlayerStatusChangedEvent
    | TeamChangedEvent
    | FootstepEvent;

/**
 * Fired when a new bullet is created.
 * Emitted by GameSimulation.spawnBullet.
 * Consumed by rendering (projectile renderer) and audio.
 */
export type BulletSpawnEvent = {
    type: 'BULLET_SPAWN';
    bulletId: number;
    ownerId: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    weaponType?: string;
};

/**
 * Fired when a bullet is destroyed (wall hit, player hit, or out-of-bounds).
 * Emitted by GameSimulation.tickProjectiles.
 * Consumed by rendering (projectile cleanup).
 */
export type BulletRemovedEvent = {
    type: 'BULLET_REMOVED';
    bulletId: number;
};

/**
 * Fired when a bullet strikes a player.
 * Emitted by GameSimulation.tickProjectiles.
 * Consumed by rendering (hit effects, damage numbers) and UI (HUD).
 */
export type BulletHitEvent = {
    type: 'BULLET_HIT';
    bulletId: number;
    targetId: number;
    attackerId: number;
    damage: number;
    x: number;
    y: number;
    isKill: boolean;
    bulletDx: number;
    bulletDy: number;
};

/**
 * Fired when a player takes damage from any source.
 * Emitted by GameSimulation.applyDamage.
 * Consumed by rendering (damage numbers) and UI (health bar).
 */
export type PlayerDamagedEvent = {
    type: 'PLAYER_DAMAGED';
    targetId: number;
    attackerId: number;
    damage: number;
    newHealth: number;
    newArmor: number;
};

/**
 * Fired when a player's health reaches zero.
 * Emitted by GameSimulation.applyDamage.
 * Consumed by AuthoritativeSimulation (kill recording, respawn scheduling),
 * rendering (death effects), and UI (kill feed).
 */
export type PlayerKilledEvent = {
    type: 'PLAYER_KILLED';
    targetId: number;
    killerId: number;
};

/**
 * Fired when a player respawns after death or at round start.
 * Emitted by AuthoritativeSimulation.respawnPlayer and startRound.
 * Consumed by rendering (player position reset) and net (state sync).
 */
export type PlayerRespawnEvent = {
    type: 'PLAYER_RESPAWN';
    playerId: number;
    x: number;
    y: number;
    rotation: number;
};

/**
 * Fired when a grenade is thrown or placed.
 * Emitted by GameSimulation.throwGrenade.
 * Consumed by rendering (grenade sprite creation) and audio.
 */
export type GrenadeSpawnEvent = {
    type: 'GRENADE_SPAWN';
    grenadeId: number;
    grenadeType: GrenadeType;
    ownerId: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    isC4: boolean;
};

/**
 * Fired when a grenade detonates (fuse expiry or manual C4 trigger).
 * Emitted by GameSimulation.detonateGrenade.
 * Consumed by rendering (explosion/flash/smoke effect modules) and audio.
 */
export type GrenadeDetonateEvent = {
    type: 'GRENADE_DETONATE';
    grenadeId: number;
    grenadeType: GrenadeType;
    x: number;
    y: number;
    ownerId: number;
    radius: number;
};

/**
 * Fired when a grenade bounces off a wall segment.
 * Emitted by GameSimulation.tickGrenades.
 * Consumed by rendering (bounce animation) and audio (bounce sound).
 */
export type GrenadeBounceEvent = {
    type: 'GRENADE_BOUNCE';
    grenadeId: number;
    x: number;
    y: number;
};

/**
 * Fired when a grenade entity is cleaned up after detonation.
 * Emitted by GameSimulation.tickGrenades.
 * Consumed by rendering (grenade sprite removal).
 */
export type GrenadeRemovedEvent = {
    type: 'GRENADE_REMOVED';
    grenadeId: number;
};

/**
 * Fired when a frag or C4 explosion damages a player.
 * Emitted by GameSimulation.applyExplosionDamage.
 * Consumed by rendering (explosion hit effects) and UI (damage indicators).
 */
export type ExplosionHitEvent = {
    type: 'EXPLOSION_HIT';
    targetId: number;
    attackerId: number;
    damage: number;
    x: number;
    y: number;
    isKill: boolean;
};

/**
 * Fired when a flashbang affects a player within its radius.
 * Emitted by GameSimulation.applyFlashEffect.
 * Consumed by rendering (flash screen overlay via flashEffect module).
 */
export type FlashEffectEvent = {
    type: 'FLASH_EFFECT';
    targetId: number;
    intensity: number;
    duration: number;
};

/**
 * Fired when a smoke grenade deploys its cloud.
 * Emitted by GameSimulation.detonateGrenade.
 * Consumed by AuthoritativeSimulation (smoke data registration),
 * rendering (smokeEffect module), and detection (LOS blocking).
 */
export type SmokeDeployEvent = {
    type: 'SMOKE_DEPLOY';
    x: number;
    y: number;
    radius: number;
    duration: number;
};

/**
 * Fired when a kill occurs, carrying display names for the kill feed.
 * Emitted by AuthoritativeSimulation.recordKill.
 * Consumed by UI (kill feed overlay).
 */
export type KillFeedEvent = {
    type: 'KILL_FEED';
    killerName: string;
    victimName: string;
    weaponType: string;
};

/**
 * Fired at the beginning of each round.
 * Emitted by AuthoritativeSimulation.startRound.
 * Consumed by UI (round counter) and orchestration (round lifecycle).
 */
export type RoundStartEvent = {
    type: 'ROUND_START';
    round: number;
};

/**
 * Fired when a round ends. Contains updated win totals and whether this ends the match.
 * Emitted by AuthoritativeSimulation.endRound.
 * Consumed by UI (scoreboard) and orchestration (match lifecycle).
 */
export type RoundEndEvent = {
    type: 'ROUND_END';
    winningTeam: number;
    teamWins: Record<number, number>;
    isFinal: boolean;
};

/**
 * Fired when a player begins reloading their weapon.
 * Emitted by AuthoritativeSimulation.processReload.
 * Consumed by rendering (reload animation) and audio (reload sound).
 */
export type ReloadStartEvent = {
    type: 'RELOAD_START';
    playerId: number;
};

/**
 * Fired when a reload finishes and the weapon's ammo is restored.
 * Emitted by AuthoritativeSimulation.tickReloads.
 * Consumed by UI (ammo counter) and rendering (status label).
 */
export type ReloadCompleteEvent = {
    type: 'RELOAD_COMPLETE';
    playerId: number;
    ammo: number;
};

/**
 * Fired when a player's status changes (idle, reloading, buying, dead, etc.).
 * Emitted by AuthoritativeSimulation.emitStatusChange.
 * Consumed by rendering (status labels) and UI (HUD state).
 */
export type PlayerStatusChangedEvent = {
    type: 'PLAYER_STATUS_CHANGED';
    playerId: number;
    status: PlayerStatus;
    previousStatus: PlayerStatus;
};

/**
 * Fired when a player switches teams.
 * Emitted by orchestration on team reassignment.
 * Consumed by rendering (player color) and UI (team display).
 */
export type TeamChangedEvent = {
    type: 'TEAM_CHANGED';
    playerId: number;
    oldTeam: number;
    newTeam: number;
};

/**
 * Fired when a player takes a step while moving.
 * Emitted by the movement system at regular intervals.
 * Consumed by audio (footstep sounds) and detection (sound-based awareness).
 */
export type FootstepEvent = {
    type: 'FOOTSTEP';
    playerId: number;
    timestamp: number;
};

/**
 * Discriminated union of all player inputs sent from client to server.
 * Each variant is processed by AuthoritativeSimulation.processInput, which
 * dispatches to the appropriate simulation sub-domain.
 */
export type PlayerInput =
    /** Directional movement. Processed by collision/movement sub-domain. */
    | { type: 'MOVE'; playerId: number; dx: number; dy: number }
    /** Aim rotation update. Processed inline by processInput. */
    | { type: 'ROTATE'; playerId: number; rotation: number }
    /** Begin firing the active weapon. Processed by shooting sub-domain. */
    | { type: 'FIRE'; playerId: number; timestamp: number }
    /** Stop firing (triggers recoil reset timer). Processed by shooting sub-domain. */
    | { type: 'STOP_FIRE'; playerId: number; timestamp: number }
    /** Reload the active weapon. Processed by shooting sub-domain. */
    | { type: 'RELOAD'; playerId: number }
    /** Switch to a weapon by inventory index. Processed by weapon management. */
    | { type: 'SWITCH_WEAPON'; playerId: number; slotIndex: number }
    /** Throw a grenade with aim direction and charge. Processed by grenade sub-domain. */
    | { type: 'THROW_GRENADE'; playerId: number; grenadeType: GrenadeType; chargePercent: number; aimDx: number; aimDy: number }
    /** Manually detonate a placed C4. Processed by grenade sub-domain. */
    | { type: 'DETONATE_C4'; playerId: number }
    /** Purchase a weapon from the buy menu. Processed by economy sub-domain. */
    | { type: 'BUY_WEAPON'; playerId: number; weaponType: string }
    /** Purchase a grenade from the buy menu. Processed by economy sub-domain. */
    | { type: 'BUY_GRENADE'; playerId: number; grenadeType: GrenadeType }
    /** Purchase a health kit. Processed by economy sub-domain. */
    | { type: 'BUY_HEALTH'; playerId: number }
    /** Purchase armor. Processed by economy sub-domain. */
    | { type: 'BUY_ARMOR'; playerId: number }
    /** Open the buy menu UI. Emits a status change event. */
    | { type: 'OPEN_BUY_MENU'; playerId: number }
    /** Close the buy menu UI. Emits a status change event. */
    | { type: 'CLOSE_BUY_MENU'; playerId: number };

/** Callback signature for GameEvent subscribers on the EventBus. */
export type EventHandler = (event: GameEvent) => void;
