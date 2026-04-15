import type { GameModeConfig, DeepPartial } from './types';

import { BASE_DEFAULTS } from './defaults';

let activeConfig: GameModeConfig = { ...BASE_DEFAULTS };

/**
 * Three-way recursive merge: for each key in `partial`, writes the override
 * value into a shallow copy of `base` pre-merged with `activeConfig`.
 *
 * Object values are merged recursively; arrays and primitives are replaced.
 *
 * @param base - The immutable baseline defaults ({@link BASE_DEFAULTS}).
 * @param activeConfig - The current runtime config snapshot.
 * @param partial - Sparse overrides from a game mode definition.
 * @returns A new config object with all three layers merged.
 */
export function deepMerge<T extends Record<string, any>>(base: T, activeConfig: T, partial: DeepPartial<T>): T {
    const result = { ...base, ...activeConfig };
    for (const key of Object.keys(partial) as (keyof T)[]) {
        const val = partial[key];
        if (val === undefined) continue;
        if (typeof val === 'object' && val !== null && !Array.isArray(val) && typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
            result[key] = deepMerge(base[key] as any, activeConfig[key] as any, val as any);
        }

        else {
            result[key] = val as any;
        }
    }

    return result;
}

/**
 * Applies a game mode's partial overrides onto the active runtime config.
 * The merge is three-way: BASE_DEFAULTS -> current activeConfig -> partial.
 *
 * @param partial - Sparse overrides defining the mode (e.g. snipers-only weapons).
 */
export function setGameMode(partial: DeepPartial<GameModeConfig>): void {
    activeConfig = deepMerge(BASE_DEFAULTS, activeConfig, partial);
}

/**
 * Resets the active config to a deep clone of {@link BASE_DEFAULTS}.
 * Called between matches to clear mode-specific overrides.
 */
export function resetConfig(): void {
    activeConfig = JSON.parse(JSON.stringify(BASE_DEFAULTS));
}

/**
 * Returns the current runtime game config.
 * The returned object is mutable -- callers should not cache references
 * across mode switches.
 *
 * @returns The active {@link GameModeConfig}.
 */
export function getConfig(): GameModeConfig {
    return activeConfig;
}
