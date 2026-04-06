import type { GameModeConfig, DeepPartial } from './types';
import { BASE_DEFAULTS } from './defaults';

let activeConfig: GameModeConfig = { ...BASE_DEFAULTS };

function deepMerge<T extends Record<string, any>>(base: T, partial: DeepPartial<T>): T {
    const result = { ...base };
    for (const key of Object.keys(partial) as (keyof T)[]) {
        const val = partial[key];
        if (val === undefined) continue;
        if (typeof val === 'object' && val !== null && !Array.isArray(val) && typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])) {
            result[key] = deepMerge(base[key] as any, val as any);
        } else {
            result[key] = val as any;
        }
    }
    return result;
}

export function resolveConfig(partial: DeepPartial<GameModeConfig>): GameModeConfig {
    return deepMerge(BASE_DEFAULTS, partial);
}

export function setGameMode(partial: DeepPartial<GameModeConfig>): void {
    activeConfig = resolveConfig(partial);
}

export function getConfig(): GameModeConfig {
    return activeConfig;
}
