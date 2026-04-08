import type { GameModeConfig, DeepPartial } from './types';
import { BASE_DEFAULTS } from './defaults';

let activeConfig: GameModeConfig = { ...BASE_DEFAULTS };

function deepMerge<T extends Record<string, any>>(base: T, activeConfig: T, partial: DeepPartial<T>): T {
    const result = { ...base, ...activeConfig };
    for (const key of Object.keys(partial) as (keyof T)[]) {
        const val = partial[key];
        if (val === undefined) continue;
        if (typeof val === 'object' && val !== null && !Array.isArray(val) && typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
            result[key] = deepMerge(base[key] as any, activeConfig[key] as any, val as any);
        } else {
            result[key] = val as any;
        }
    }
    return result;
}

export function setGameMode(partial: DeepPartial<GameModeConfig>): void {
    activeConfig = deepMerge(BASE_DEFAULTS, activeConfig, partial);
}

export function getConfig(): GameModeConfig {
    return activeConfig;
}