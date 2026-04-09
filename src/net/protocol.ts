import type { GameEvent, PlayerInput } from './gameEvent';
import type { GameModeConfig, DeepPartial } from '../Config/types';

export type MapJSON = {
    version?: 1;
    name?: string;
    width?: number;
    height?: number;
    teamSpawns: Record<number, { x: number; y: number }[]>;
    patrolPoints: { x: number; y: number }[];
    walls: {
        x: number;
        y: number;
        width: number;
        height: number;
        type?: WallType;
    }[];
};

export type PlayerSnapshot = {
    id: number;
    name: string;
    team: number;
    x: number;
    y: number;
    rotation: number;
    health: number;
    armour: number;
    dead: boolean;
    money: number;
    weapons: PlayerWeapon[];
    grenades: Record<GrenadeType, number>;
};

export type SimProjectileSnapshot = {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    damage: number;
    ownerId: number;
    weaponType?: string;
};

export type SimGrenadeSnapshot = {
    id: number;
    type: GrenadeType;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    ownerId: number;
    spawnTime: number;
    detonated: boolean;
};

export type LobbyPlayer = {
    id: number;
    name: string;
    team: number;
    ready: boolean;
    isHost: boolean;
};

export type ClientMessage =
    | { v: 1; t: 'join'; name: string }
    | { v: 1; t: 'input'; seq: number; input: PlayerInput }
    | { v: 1; t: 'leave' }
    | { v: 1; t: 'set_config'; config: DeepPartial<GameModeConfig> }
    | { v: 1; t: 'set_map'; mapName: string; mapJSON?: MapJSON }
    | { v: 1; t: 'move_player'; playerId: number; team: number }
    | { v: 1; t: 'start_game' }
    | { v: 1; t: 'ready'; ready: boolean };

export type ServerMessage =
    | {
          v: 1;
          t: 'welcome';
          playerId: number;
          mapData: MapJSON;
          config: GameModeConfig;
          players: PlayerSnapshot[];
          isHost?: boolean;
          phase?: string;
      }
    | { v: 1; t: 'player_joined'; player: PlayerSnapshot }
    | { v: 1; t: 'player_left'; playerId: number }
    | { v: 1; t: 'events'; tick: number; events: GameEvent[] }
    | {
          v: 1;
          t: 'snapshot';
          tick: number;
          players: PlayerSnapshot[];
          projectiles: SimProjectileSnapshot[];
          grenades: SimGrenadeSnapshot[];
          timeRemaining: number;
      }
    | { v: 1; t: 'input_ack'; seq: number; x: number; y: number }
    | {
          v: 1;
          t: 'lobby_state';
          host: number;
          players: LobbyPlayer[];
          config: GameModeConfig;
          mapName: string;
          started: boolean;
      }
    | { v: 1; t: 'game_starting'; countdown: number };
