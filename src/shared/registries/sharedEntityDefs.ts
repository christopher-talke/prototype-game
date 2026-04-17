/**
 * Shared entity-type registry. Ships empty in Phase 2b; stock entity types
 * (doors, generators, terminals) land here in later phases.
 *
 * Layer: shared. Consumed by `EntityDefRegistry` in orchestration for the
 * three-tier lookup (local → shared → error).
 */

import type { EntityTypeDefinition } from '@shared/map/MapData';

export const SHARED_ENTITY_DEFS: readonly EntityTypeDefinition[] = [];
