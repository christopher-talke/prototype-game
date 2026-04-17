/**
 * Three-tier entity-type resolver: local map defs override shared defs,
 * unresolved ids throw. Mirrors `ObjectDefRegistry` for entity placements.
 *
 * Layer: orchestration. Consumed by entity runtime (Phase 2c) and the
 * validator's entity placement checks.
 */

import type { EntityTypeDefinition } from '@shared/map/MapData';
import { SHARED_ENTITY_DEFS } from '@shared/registries/sharedEntityDefs';

export class EntityDefRegistry {
    private readonly local: Map<string, EntityTypeDefinition>;
    private readonly shared: ReadonlyMap<string, EntityTypeDefinition>;

    constructor(localDefs: readonly EntityTypeDefinition[], sharedDefs: readonly EntityTypeDefinition[] = SHARED_ENTITY_DEFS) {
        this.local = new Map();
        for (const def of localDefs) this.local.set(def.id, def);

        const sharedMap = new Map<string, EntityTypeDefinition>();
        for (const def of sharedDefs) sharedMap.set(def.id, def);
        this.shared = sharedMap;
    }

    resolve(id: string): EntityTypeDefinition {
        const local = this.local.get(id);
        if (local) return local;
        const shared = this.shared.get(id);
        if (shared) return shared;
        throw new Error(`EntityDefRegistry: unresolved entityTypeId "${id}" (checked: local, shared)`);
    }

    has(id: string): boolean {
        return this.local.has(id) || this.shared.has(id);
    }
}
