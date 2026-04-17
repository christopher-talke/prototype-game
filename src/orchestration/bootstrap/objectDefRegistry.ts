/**
 * Three-tier object-definition resolver: local map defs override shared
 * defs, unresolved ids throw.
 *
 * Layer: orchestration -- sole owner of map-level registries. Built once per
 * map load; never mutated at runtime.
 */

import type { ObjectDefinition } from '@shared/map/MapData';
import { SHARED_OBJECT_DEFS } from '@shared/registries/sharedObjectDefs';

export class ObjectDefRegistry {
    private readonly local: Map<string, ObjectDefinition>;
    private readonly shared: ReadonlyMap<string, ObjectDefinition>;

    constructor(localDefs: readonly ObjectDefinition[], sharedDefs: readonly ObjectDefinition[] = SHARED_OBJECT_DEFS) {
        this.local = new Map();
        for (const def of localDefs) this.local.set(def.id, def);

        const sharedMap = new Map<string, ObjectDefinition>();
        for (const def of sharedDefs) sharedMap.set(def.id, def);
        this.shared = sharedMap;
    }

    /**
     * Resolves an object def id with local-first precedence. Throws with a
     * message listing which tiers were attempted so validator output can
     * surface the failure verbatim.
     */
    resolve(id: string): ObjectDefinition {
        const local = this.local.get(id);
        if (local) return local;
        const shared = this.shared.get(id);
        if (shared) return shared;
        throw new Error(`ObjectDefRegistry: unresolved objectDefId "${id}" (checked: local, shared)`);
    }

    has(id: string): boolean {
        return this.local.has(id) || this.shared.has(id);
    }
}
