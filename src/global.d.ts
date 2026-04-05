type GameMode = 'ffa' | 'tdm';

interface GameSettings {
  debug: boolean;
  gameMode: GameMode;
  raycast: {
    type: string;
  };
  audio: {
    masterVolume: number;
    sfxVolume: number;
    muted: boolean;
  };
}

interface player_info {
  id: number;
  name: string;
  current_position: {
    x: number;
    y: number;
    rotation: number;
  };
  health: number;
  armour: number;
  team: number;
  dead: boolean;
  weapons: PlayerWeapon[];
  grenades: Record<GrenadeType, number>;
}

type PlayerWeapon = {
  id: number;
  active: boolean;
  type: string;
  ammo: number;
  maxAmmo: number;
  firing_rate: number;
  reloading: boolean;
};

type WeaponDef = {
  id: string;
  name: string;
  damage: number;
  fireRate: number;
  reloadTime: number;
  magSize: number;
  bulletSpeed: number;
  price: number;
  killReward: number;
  pellets: number;
  spread: number;
  cameraOffset: number;
  recoilPattern: { x: number; y: number }[];
  mechanicalSound?: string;
  mechanicalDelay?: number;
  shellReloadTime?: number;
};

type ProjectileState = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  damage: number;
  ownerId: number;
  element: HTMLElement;
  alive: boolean;
  weaponType?: string;
};

type PlayerGameState = {
  playerId: number;
  kills: number;
  deaths: number;
  money: number;
  points: number;
};

interface wall_info {
  x: number;
  y: number;
  width: number;
  height: number;
  type?: WallType;
  sprite?: string; // URL or path to sprite image
}

type WallType =
  | 'concrete'   // default - solid block
  | 'metal'      // corrugated metal panels
  | 'crate'      // wooden crate
  | 'sandbag'    // cover/sandbag pile
  | 'barrier'    // jersey barrier / road block
  | 'pillar';    // thin structural column

type coordinates = {
  x: number;
  y: number;
};

type GrenadeType = 'FRAG' | 'FLASH' | 'SMOKE' | 'C4';

type GrenadeDef = {
  id: GrenadeType;
  name: string;
  price: number;
  throwSpeed: number;
  fuseTime: number;
  radius: number;
  damage: number;
  effectDuration: number;
  shrapnelCount?: number;
  shrapnelDamage?: number;
  shrapnelSpeed?: number;
};

type GrenadeState = {
  id: number;
  type: GrenadeType;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  ownerId: number;
  element: HTMLElement;
  spawnTime: number;
  detonated: boolean;
};

type MapData = {
  teamSpawns: Record<number, coordinates[]>;
  walls: wall_info[];
};

type RayPoint = {
  x: number;
  y: number;
  d: number;
};

type elementCoordinates = {
  x: number;
  y: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type WallSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Corner = {
  x: number;
  y: number;
};

type Environment = {
  limits: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  segments: WallSegment[];
  corners: Corner[];
  collisions: CollisionMap;
};

interface CollisionMap {
  [key: string]: Collision;
}

type Collision = {
  type: string;
  entity: boolean;
  ray: boolean;
  projectile: boolean;
  isCorner: boolean;
};

type raycast_config = {
  number_of_rays?: number;
  type: RaycastTypes;
};

enum RaycastTypes {
  SPRAY = "SPRAY",
  CORNERS = "CORNERS",
}
