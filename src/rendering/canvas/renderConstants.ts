// Shared constants used across multiple canvas renderer files.
// Single-file constants stay in their respective modules.

// Colors
export const BACKGROUND_COLOR = 0x0f0f1a;
export const BULLET_COLOR = 0xffcc00;
export const WALL_SPARK_COLOR = 0xffaa44;
export const CRITICAL_HEALTH_COLOR = 0xff2222;

// Lighting / GPU limits
export const LIGHTMAP_SCALE = 0.5;
export const MAX_GPU_LIGHTS = 128;
export const MAX_GPU_WALLS = 512;
export const LAST_KNOWN_DECAY_MS = 3500;
