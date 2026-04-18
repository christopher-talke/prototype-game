/**
 * Schema migration registry for MapData.
 *
 * Each registered step migrates one version forward. `migrateToLatest` loops
 * until `meta.version === CURRENT_VERSION`. Saves always write the current
 * version.
 *
 * Part of the editor layer.
 */

import type { MapData } from '@shared/map/MapData';

/** Current MapData schema version. Bump when introducing a breaking change. */
export const CURRENT_VERSION = 1;

type Migrator = (data: any) => any;

const migrators: Map<number, Migrator> = new Map();

/** Register a migrator that transforms data from `fromVersion` to `fromVersion + 1`. */
export function registerMigration(fromVersion: number, migrator: Migrator): void {
    migrators.set(fromVersion, migrator);
}

/**
 * Apply registered migrators in sequence until the data is at `CURRENT_VERSION`.
 * Missing `meta.version` is treated as version 1. Throws if no migrator is
 * registered for an intermediate step.
 */
export function migrateToLatest(data: any): MapData {
    if (!data || typeof data !== 'object') {
        throw new Error('migrateToLatest: input is not an object');
    }
    if (!data.meta || typeof data.meta !== 'object') {
        throw new Error('migrateToLatest: missing meta');
    }

    let version = typeof data.meta.version === 'number' ? data.meta.version : 1;
    let current = data;

    while (version < CURRENT_VERSION) {
        const step = migrators.get(version);
        if (!step) {
            throw new Error(
                `migrateToLatest: no migrator registered for v${version} -> v${version + 1}`,
            );
        }
        current = step(current);
        version += 1;
        current.meta.version = version;
    }

    current.meta.version = CURRENT_VERSION;
    return current as MapData;
}
