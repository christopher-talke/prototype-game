/**
 * Defines the structure of game events that are sent from the server to the client, as well as player input events sent from the client to the server. 
 * Also includes an event bus for subscribing to and emitting these events.
 * This file serves as a central place to define all the different types of events that can occur in the game, such as player actions, combat events, grenade events, and match events. 
 * It also defines the structure of player input events that the client sends to the server to indicate player intentions.
 */

export type GameEvent =
    // Projectiles
    | BulletSpawnEvent
    | BulletRemovedEvent
    | BulletHitEvent

    // Player combat
    | PlayerDamagedEvent
    | PlayerKilledEvent
    | PlayerRespawnEvent

    // Grenades
    | GrenadeSpawnEvent
    | GrenadeDetonateEvent
    | GrenadeBounceEvent
    | GrenadeRemovedEvent

    // Grenade effects
    | ExplosionHitEvent
    | FlashEffectEvent
    | SmokeDeployEvent

    // Match / economy
    | KillFeedEvent
    | RoundStartEvent
    | RoundEndEvent

    // Reload
    | ReloadStartEvent
    | ReloadCompleteEvent

    // Player status
    | PlayerStatusChangedEvent

    // Movement
    | FootstepEvent;

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

export type BulletRemovedEvent = {
    type: 'BULLET_REMOVED';
    bulletId: number;
};

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

// -- Player combat events --

export type PlayerDamagedEvent = {
    type: 'PLAYER_DAMAGED';
    targetId: number;
    attackerId: number;
    damage: number;
    newHealth: number;
    newArmor: number;
};

export type PlayerKilledEvent = {
    type: 'PLAYER_KILLED';
    targetId: number;
    killerId: number;
};

export type PlayerRespawnEvent = {
    type: 'PLAYER_RESPAWN';
    playerId: number;
    x: number;
    y: number;
    rotation: number;
};

// -- Grenade events --

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

export type GrenadeDetonateEvent = {
    type: 'GRENADE_DETONATE';
    grenadeId: number;
    grenadeType: GrenadeType;
    x: number;
    y: number;
    ownerId: number;
    radius: number;
};

export type GrenadeBounceEvent = {
    type: 'GRENADE_BOUNCE';
    grenadeId: number;
    x: number;
    y: number;
};

export type GrenadeRemovedEvent = {
    type: 'GRENADE_REMOVED';
    grenadeId: number;
};

// -- Grenade effect events --

export type ExplosionHitEvent = {
    type: 'EXPLOSION_HIT';
    targetId: number;
    attackerId: number;
    damage: number;
    x: number;
    y: number;
    isKill: boolean;
};

export type FlashEffectEvent = {
    type: 'FLASH_EFFECT';
    targetId: number;
    intensity: number;
    duration: number;
};

export type SmokeDeployEvent = {
    type: 'SMOKE_DEPLOY';
    x: number;
    y: number;
    radius: number;
    duration: number;
};

// -- Match / economy events --

export type KillFeedEvent = {
    type: 'KILL_FEED';
    killerName: string;
    victimName: string;
    weaponType: string;
};

export type RoundStartEvent = {
    type: 'ROUND_START';
    round: number;
};

export type RoundEndEvent = {
    type: 'ROUND_END';
    winningTeam: number;
    teamWins: Record<number, number>;
    isFinal: boolean;
};

export type ReloadStartEvent = {
    type: 'RELOAD_START';
    playerId: number;
};

export type ReloadCompleteEvent = {
    type: 'RELOAD_COMPLETE';
    playerId: number;
    ammo: number;
};

// -- Player status events --

import { PlayerStatus } from '@simulation/player/playerData';

export type PlayerStatusChangedEvent = {
    type: 'PLAYER_STATUS_CHANGED';
    playerId: number;
    status: PlayerStatus;
    previousStatus: PlayerStatus;
};

// -- Movement events --

export type FootstepEvent = {
    type: 'FOOTSTEP';
    playerId: number;
    timestamp: number;
};

// -- Player input (what the client sends to the server) --

export type PlayerInput =
    | { type: 'MOVE'; playerId: number; dx: number; dy: number }
    | { type: 'ROTATE'; playerId: number; rotation: number }
    | { type: 'FIRE'; playerId: number; timestamp: number }
    | { type: 'STOP_FIRE'; playerId: number; timestamp: number }
    | { type: 'RELOAD'; playerId: number }
    | { type: 'SWITCH_WEAPON'; playerId: number; slotIndex: number }
    | { type: 'THROW_GRENADE'; playerId: number; grenadeType: GrenadeType; chargePercent: number; aimDx: number; aimDy: number }
    | { type: 'DETONATE_C4'; playerId: number }
    | { type: 'BUY_WEAPON'; playerId: number; weaponType: string }
    | { type: 'BUY_GRENADE'; playerId: number; grenadeType: GrenadeType }
    | { type: 'BUY_HEALTH'; playerId: number }
    | { type: 'BUY_ARMOR'; playerId: number }
    | { type: 'OPEN_BUY_MENU'; playerId: number }
    | { type: 'CLOSE_BUY_MENU'; playerId: number };

// -- Event bus --

export type EventHandler = (event: GameEvent) => void;

class EventBus {
    private handlers: EventHandler[] = [];

    subscribe(handler: EventHandler): () => void {
        this.handlers.push(handler);
        return () => {
            const i = this.handlers.indexOf(handler);
            if (i >= 0) this.handlers.splice(i, 1);
        };
    }

    emit(event: GameEvent) {
        for (const h of this.handlers) h(event);
    }

    emitAll(events: GameEvent[]) {
        for (const e of events) this.emit(e);
    }
}

// Singleton bus for the game
export const gameEventBus = new EventBus();
