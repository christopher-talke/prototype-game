/**
 * Shipment map data -- compact container yard (~1600x1600 interior inside a 3000x3000 world).
 * Tight lanes between shipping containers force constant close-quarters combat.
 * Symmetric east-west spawns with mirrored cover placement.
 *
 * v1.5 layered schema. Pure declarative data: every wall, zone, and nav hint
 * is a literal object. No factory helpers; no derivation at import time.
 */

import type { MapData } from '@shared/map/MapData';

export const Shipment: MapData = {
    meta: {
        id: 'shipment',
        name: 'Shipment',
        author: '',
        version: 1,
        thumbnail: '',
        gameModes: ['tdm'],
        playerCount: { min: 2, max: 10, recommended: 6 },
    },
    bounds: {
        width: 3000,
        height: 3000,
        playableArea: { x: 0, y: 0, width: 3000, height: 3000 },
        oobKillMargin: 200,
    },
    postProcess: {
        bloomIntensity: 0,
        chromaticAberration: 0,
        ambientLightColor: { r: 18, g: 22, b: 32 },
        ambientLightIntensity: 0.25,
        vignetteIntensity: 0,
    },
    audio: { ambientLoop: null, reverbProfile: 'default' },
    objectDefs: [],
    entityDefs: [],
    floors: [{ id: 'ground', label: 'Ground Floor', renderOrder: 0 }],
    signals: [],
    layers: [
        {
            id: 'layer_floor',
            floorId: 'ground',
            type: 'floor',
            label: 'Floor',
            locked: false,
            visible: true,
            walls: [],
            objects: [],
            entities: [],
            lights: [],
            decals: [
                {
                    id: 'decal_floor_texture',
                    assetPath: 'concrete_floor_worn.jpg',
                    position: { x: 1500, y: 1500 },
                    rotation: 0,
                    scale: { x: 3000, y: 3000 },
                    alpha: 0.95,
                    blendMode: 'normal',
                    tint: { r: 30, g: 36, b: 52 },
                    repeat: { x: 16, y: 16 },
                },
            ],
        },
        {
            id: 'layer_walls',
            floorId: 'ground',
            type: 'collision',
            label: 'Walls',
            locked: false,
            visible: true,
            objects: [],
            entities: [],
            decals: [],
            lights: [],
            walls: [
                { id: 'wall_001', wallType: 'metal', vertices: [{ x: 700, y: 700 }, { x: 2300, y: 700 }, { x: 2300, y: 780 }, { x: 700, y: 780 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_002', wallType: 'metal', vertices: [{ x: 700, y: 2220 }, { x: 2300, y: 2220 }, { x: 2300, y: 2300 }, { x: 700, y: 2300 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_003', wallType: 'metal', vertices: [{ x: 700, y: 780 }, { x: 780, y: 780 }, { x: 780, y: 2220 }, { x: 700, y: 2220 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_004', wallType: 'metal', vertices: [{ x: 2220, y: 780 }, { x: 2300, y: 780 }, { x: 2300, y: 2220 }, { x: 2220, y: 2220 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },

                { id: 'wall_005', wallType: 'crate', vertices: [{ x: 900, y: 960 }, { x: 1180, y: 960 }, { x: 1180, y: 1080 }, { x: 900, y: 1080 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_006', wallType: 'crate', vertices: [{ x: 1820, y: 960 }, { x: 2100, y: 960 }, { x: 2100, y: 1080 }, { x: 1820, y: 1080 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },

                { id: 'wall_007', wallType: 'crate', vertices: [{ x: 1100, y: 1280 }, { x: 1220, y: 1280 }, { x: 1220, y: 1560 }, { x: 1100, y: 1560 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_008', wallType: 'crate', vertices: [{ x: 1360, y: 1440 }, { x: 1640, y: 1440 }, { x: 1640, y: 1560 }, { x: 1360, y: 1560 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_009', wallType: 'crate', vertices: [{ x: 1780, y: 1280 }, { x: 1900, y: 1280 }, { x: 1900, y: 1560 }, { x: 1780, y: 1560 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },

                { id: 'wall_010', wallType: 'crate', vertices: [{ x: 900, y: 1920 }, { x: 1180, y: 1920 }, { x: 1180, y: 2040 }, { x: 900, y: 2040 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_011', wallType: 'crate', vertices: [{ x: 1820, y: 1920 }, { x: 2100, y: 1920 }, { x: 2100, y: 2040 }, { x: 1820, y: 2040 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },
                { id: 'wall_012', wallType: 'crate', vertices: [{ x: 1440, y: 1700 }, { x: 1560, y: 1700 }, { x: 1560, y: 1900 }, { x: 1440, y: 1900 }], solid: true, occludesVision: true, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: true },

                { id: 'wall_013', wallType: 'sandbag', vertices: [{ x: 1440, y: 900 }, { x: 1500, y: 900 }, { x: 1500, y: 960 }, { x: 1440, y: 960 }], solid: true, occludesVision: false, bulletPenetrable: true, penetrationDecay: 0.4, audioOcclude: false },
                { id: 'wall_014', wallType: 'sandbag', vertices: [{ x: 1440, y: 2080 }, { x: 1500, y: 2080 }, { x: 1500, y: 2140 }, { x: 1440, y: 2140 }], solid: true, occludesVision: false, bulletPenetrable: true, penetrationDecay: 0.4, audioOcclude: false },
                { id: 'wall_015', wallType: 'sandbag', vertices: [{ x: 850, y: 1440 }, { x: 910, y: 1440 }, { x: 910, y: 1500 }, { x: 850, y: 1500 }], solid: true, occludesVision: false, bulletPenetrable: true, penetrationDecay: 0.4, audioOcclude: false },
                { id: 'wall_016', wallType: 'sandbag', vertices: [{ x: 2100, y: 1440 }, { x: 2160, y: 1440 }, { x: 2160, y: 1500 }, { x: 2100, y: 1500 }], solid: true, occludesVision: false, bulletPenetrable: true, penetrationDecay: 0.4, audioOcclude: false },

                { id: 'wall_017', wallType: 'barrier', vertices: [{ x: 820, y: 820 }, { x: 870, y: 820 }, { x: 870, y: 870 }, { x: 820, y: 870 }], solid: true, occludesVision: false, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: false },
                { id: 'wall_018', wallType: 'barrier', vertices: [{ x: 2130, y: 820 }, { x: 2180, y: 820 }, { x: 2180, y: 870 }, { x: 2130, y: 870 }], solid: true, occludesVision: false, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: false },
                { id: 'wall_019', wallType: 'barrier', vertices: [{ x: 820, y: 2130 }, { x: 870, y: 2130 }, { x: 870, y: 2180 }, { x: 820, y: 2180 }], solid: true, occludesVision: false, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: false },
                { id: 'wall_020', wallType: 'barrier', vertices: [{ x: 2130, y: 2130 }, { x: 2180, y: 2130 }, { x: 2180, y: 2180 }, { x: 2130, y: 2180 }], solid: true, occludesVision: false, bulletPenetrable: false, penetrationDecay: 0, audioOcclude: false },
            ],
        },
    ],
    zones: [
        { id: 'spawn_t1_1', type: 'spawn', label: 'Team 1 Spawn 1', team: '1', polygon: [{ x: 780, y: 1250 }, { x: 880, y: 1250 }, { x: 880, y: 1350 }, { x: 780, y: 1350 }] },
        { id: 'spawn_t1_2', type: 'spawn', label: 'Team 1 Spawn 2', team: '1', polygon: [{ x: 780, y: 1650 }, { x: 880, y: 1650 }, { x: 880, y: 1750 }, { x: 780, y: 1750 }] },
        { id: 'spawn_t2_1', type: 'spawn', label: 'Team 2 Spawn 1', team: '2', polygon: [{ x: 2070, y: 1250 }, { x: 2170, y: 1250 }, { x: 2170, y: 1350 }, { x: 2070, y: 1350 }] },
        { id: 'spawn_t2_2', type: 'spawn', label: 'Team 2 Spawn 2', team: '2', polygon: [{ x: 2070, y: 1650 }, { x: 2170, y: 1650 }, { x: 2170, y: 1750 }, { x: 2070, y: 1750 }] },
    ],
    navHints: [
        { id: 'nav_cover_01', type: 'cover', position: { x: 1000, y: 880 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_02', type: 'cover', position: { x: 1500, y: 880 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_03', type: 'cover', position: { x: 2000, y: 880 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_04', type: 'cover', position: { x: 1000, y: 1500 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_05', type: 'cover', position: { x: 1500, y: 1350 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_06', type: 'cover', position: { x: 2000, y: 1500 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_07', type: 'cover', position: { x: 1000, y: 2080 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_08', type: 'cover', position: { x: 1500, y: 2080 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_09', type: 'cover', position: { x: 2000, y: 2080 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_10', type: 'cover', position: { x: 850, y: 1200 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_11', type: 'cover', position: { x: 2150, y: 1200 }, radius: 100, weight: 0.5 },
        { id: 'nav_cover_12', type: 'cover', position: { x: 1500, y: 1700 }, radius: 100, weight: 0.5 },
    ],
};
