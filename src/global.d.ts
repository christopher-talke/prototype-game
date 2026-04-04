interface GameSettings {
  debug: boolean;
  raycast: {
    type: string;
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
  weapons: {
    id: number;
    active: boolean;
    type: string;
    ammo: number;
    firing_rate: number;
  }[];
}

interface wall_info {
  x: number;
  y: number;
  width: number;
  height: number;
}

type coordinates = {
  x: number;
  y: number;
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
  // Legacy collision map - kept during Phase 1-2, removed in Phase 3
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

