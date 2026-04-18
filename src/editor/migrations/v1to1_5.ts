/**
 * Placeholder migrator -- demonstrates the registration pattern.
 *
 * Current MapData schema is v1 (see `meta.version` on existing maps). No
 * upgrade is needed yet. When `CURRENT_VERSION` is bumped, replace this with
 * a real migrator and register it.
 *
 * Part of the editor layer.
 */

// Intentionally empty. The registration side-effect would go here, e.g.:
//   registerMigration(1, (data) => { ...transform v1 -> v2... });
// See migrationRegistry.ts for the API.

export {};
