/**
 * Canonical map config types -- v1.5 spec (see .priv-docs/map-spec.md).
 *
 * Layer: shared (dependency root). No imports from simulation/rendering/net/
 * orchestration. Pure type declarations; no runtime code.
 *
 * Each compiler (physics, renderer, AI, editor) derives its own runtime
 * representation from these types. Config is never mutated by compiled output.
 */

export interface Vec2 {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RGBColor {
    r: number;
    g: number;
    b: number;
}

export type BlendMode = 'normal' | 'additive' | 'multiply' | 'screen';
export type ReverbProfileId = string;
export type GameModeId = string;
export type TeamId = string;

export interface SpriteLayer {
    assetPath: string;
    offset: Vec2;
    zOffset: number;
    blendMode: BlendMode;
    alpha: number;
    tint?: RGBColor;
}

export interface PlayerCountRange {
    min: number;
    max: number;
    recommended: number;
}

export interface MapMeta {
    id: string;
    name: string;
    author: string;
    version: number;
    thumbnail: string;
    gameModes: GameModeId[];
    playerCount: PlayerCountRange;
}

export interface MapBounds {
    width: number;
    height: number;
    playableArea: Rect;
    oobKillMargin: number;
}

export interface MapPostProcessProfile {
    bloomIntensity: number;
    chromaticAberration: number;
    ambientLightColor: RGBColor;
    ambientLightIntensity: number;
    vignetteIntensity: number;
}

export interface MapAudioConfig {
    ambientLoop: string | null;
    reverbProfile: ReverbProfileId;
}

export interface Floor {
    id: string;
    label: string;
    renderOrder: number;
    ambientOverride?: Partial<MapPostProcessProfile>;
}

export interface MapSignal {
    id: string;
    label: string;
}

export type WallType =
    | 'concrete'
    | 'metal'
    | 'crate'
    | 'sandbag'
    | 'barrier'
    | 'pillar';

export interface Wall {
    id: string;
    vertices: Vec2[];
    solid: boolean;
    bulletPenetrable: boolean;
    penetrationDecay: number;
    audioOcclude: boolean;
    occludesVision: boolean;
    wallType: WallType;
}

export type CollisionShape =
    | { type: 'aabb'; x: number; y: number; width: number; height: number }
    | { type: 'polygon'; vertices: Vec2[] }
    | { type: 'circle'; center: Vec2; radius: number };

export interface LightSourceDef {
    offset: Vec2;
    color: RGBColor;
    intensity: number;
    radius: number;
    coneAngle: number;
    coneDirection: number;
    castShadows: boolean;
}

export interface LightPlacement {
    id: string;
    position: Vec2;
    color: RGBColor;
    intensity: number;
    radius: number;
    coneAngle: number;
    coneDirection: number;
    castShadows: boolean;
}

export interface ObjectDefinition {
    id: string;
    label: string;
    collisionShape: CollisionShape | null;
    lights: LightSourceDef[];
    sprites: SpriteLayer[];
    pivot: Vec2;
}

export interface ObjectPlacement {
    id: string;
    objectDefId: string;
    position: Vec2;
    rotation: number;
    scale: Vec2;
}

export type EntityStateFieldDescriptor =
    | { type: 'layerId' }
    | { type: 'entityId' }
    | { type: 'teamId' }
    | { type: 'signalId' }
    | { type: 'primitive' }
    | { type: 'color' }
    | { type: 'range'; min: number; max: number; step?: number }
    | { type: 'nested'; fields: Record<string, EntityStateFieldDescriptor> }
    | { type: 'array'; element: EntityStateFieldDescriptor };

export interface EntityTypeDefinition {
    id: string;
    label: string;
    collisionShape: CollisionShape | null;
    interactionRadius: number;
    initialState: Record<string, unknown>;
    stateSchema?: Record<string, EntityStateFieldDescriptor>;
    sprites: SpriteLayer[];
    lights: LightSourceDef[];
    gameModeFilter?: GameModeId[];
}

export interface EntityPlacement {
    id: string;
    entityTypeId: string;
    position: Vec2;
    rotation: number;
    initialState: Record<string, unknown>;
}

export interface DecalPlacement {
    id: string;
    assetPath: string;
    position: Vec2;
    rotation: number;
    scale: Vec2;
    alpha: number;
    blendMode: BlendMode;
    /** Optional multiplicative colour tint (0-255 RGB). Omit = no tint. */
    tint?: RGBColor;
    /** Optional tile repeat count across the decal footprint. Omit = stretch-fit. */
    repeat?: Vec2;
}

export type LayerType = 'floor' | 'collision' | 'object' | 'overhead' | 'ceiling';

export interface MapLayer {
    id: string;
    floorId: string;
    type: LayerType;
    label: string;
    locked: boolean;
    visible: boolean;
    walls: Wall[];
    objects: ObjectPlacement[];
    entities: EntityPlacement[];
    decals: DecalPlacement[];
    lights: LightPlacement[];
}

export interface FloorTransitionMeta {
    fromFloorId: string;
    toFloorId: string;
    direction: 'up' | 'down' | 'both';
}

export interface AudioZoneMeta {
    reverbProfile: ReverbProfileId;
    ambientLoop: string | null;
}

export interface TriggerEvent {
    on: 'enter' | 'exit' | 'both';
    signal: string;
    target: 'player' | 'team' | 'all';
    teamId?: TeamId;
    once: boolean;
    timeout: number | null;
}

export type ZoneType =
    | 'spawn'
    | 'territory'
    | 'bombsite'
    | 'buyzone'
    | 'trigger'
    | 'extract'
    | 'audio'
    | 'floor-transition';

export interface Zone {
    id: string;
    type: ZoneType;
    label: string;
    polygon: Vec2[];
    floorId?: string;
    team?: TeamId;
    gameModes?: GameModeId[];
    meta?: Record<string, unknown>;
}

export type NavHintType = 'cover' | 'choke' | 'flank' | 'danger' | 'objective';

export interface NavHint {
    id: string;
    type: NavHintType;
    position: Vec2;
    radius: number;
    weight: number;
}

export interface MapData {
    meta: MapMeta;
    bounds: MapBounds;
    postProcess: MapPostProcessProfile;
    audio: MapAudioConfig;
    objectDefs: ObjectDefinition[];
    entityDefs: EntityTypeDefinition[];
    floors: Floor[];
    signals: MapSignal[];
    layers: MapLayer[];
    zones: Zone[];
    navHints: NavHint[];
}
