/**
 * Default MapData for `New Map`.
 *
 * A minimal but schema-valid MapData: one floor, no layers, no content.
 * Follows the v1.5 layered schema (see `src/shared/map/MapData.ts`).
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

import { CURRENT_VERSION } from '../migrations/migrationRegistry';

/** Build a fresh empty MapData for a new editor session. */
export function createDefaultMapData(): MapData {
    return {
        meta: {
            id: 'untitled',
            name: 'Untitled',
            author: '',
            version: CURRENT_VERSION,
            thumbnail: '',
            gameModes: [],
            playerCount: { min: 1, max: 1, recommended: 1 },
        },
        bounds: {
            width: 3000,
            height: 3000,
            playableArea: { x: 0, y: 0, width: 3000, height: 3000 },
            oobKillMargin: 100,
        },
        postProcess: {
            bloomIntensity: 0,
            chromaticAberration: 0,
            ambientLightColor: { r: 16, g: 16, b: 24 },
            ambientLightIntensity: 0.15,
            vignetteIntensity: 0,
        },
        audio: { ambientLoop: null, reverbProfile: 'default' },
        objectDefs: [],
        entityDefs: [],
        floors: [{ id: 'ground', label: 'Ground Floor', renderOrder: 0 }],
        signals: [],
        layers: [
            {
                id: 'layer-collision',
                floorId: 'ground',
                type: 'collision',
                label: 'Collision',
                locked: false,
                visible: true,
                walls: [],
                objects: [],
                entities: [],
                decals: [],
                lights: [],
            },
        ],
        zones: [],
        navHints: [],
    };
}
