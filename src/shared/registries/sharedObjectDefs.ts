/**
 * Shared object-definition registry. Ships empty in Phase 2b; future PRs add
 * stock props (barrels, crates, stock doors) reusable across maps.
 *
 * Layer: shared. Consumed by `ObjectDefRegistry` in orchestration for the
 * three-tier lookup (local → shared → error).
 */

import type { ObjectDefinition } from '@shared/map/MapData';

export const SHARED_OBJECT_DEFS: readonly ObjectDefinition[] = [];
