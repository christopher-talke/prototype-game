/**
 * Object definition resolver. Phase 2a ships a local-only implementation;
 * Phase 2b extends it with a shared startup registry fall-through.
 *
 * Layer: orchestration -- sole owner of map-level registries.
 */

import type { ObjectDefinition } from '@shared/map/MapData';

export class ObjectDefRegistry {
    private readonly local: Map<string, ObjectDefinition>;

    constructor(localDefs: readonly ObjectDefinition[]) {
        this.local = new Map();
        for (const def of localDefs) this.local.set(def.id, def);
    }

    /**
     * Resolves an object def id. Local map definitions win; unresolved ids throw
     * so upstream validators catch typos before simulation starts.
     *
     * Phase 2b will extend this to fall through to a shared registry before
     * throwing.
     */
    resolve(id: string): ObjectDefinition {
        const def = this.local.get(id);
        if (!def) throw new Error(`ObjectDefRegistry: unresolved objectDefId "${id}"`);
        return def;
    }

    has(id: string): boolean {
        return this.local.has(id);
    }
}
