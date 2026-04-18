/**
 * Shared constants used across multiple canvas renderer files.
 * Single-file constants stay in their respective modules.
 *
 * Part of the canvas rendering layer.
 */

export const BACKGROUND_COLOR = 0x0f0f1a;
/** Used by aim line renderer and grenade trajectory. */
export const BULLET_COLOR = 0xffcc00;
export const CRITICAL_HEALTH_COLOR = 0xff2222;

/**
 * Resolution scale for the GPU lightmap RenderTexture.
 * Written by `applyGraphicsConfig()` -- do not set directly.
 */
export let LIGHTMAP_SCALE = 0.5;

/** Setter for LIGHTMAP_SCALE, called by applyGraphicsConfig(). */
export function setLightmapScale(v: number) {
    LIGHTMAP_SCALE = v;
}

/** Maximum number of lights uploadable to the lighting shader in a single frame. */
export const MAX_GPU_LIGHTS = 128;
/** Maximum number of wall edge segments uploadable to the lighting shader in a single frame. */
export const MAX_GPU_SEGMENTS = 512;
/** Duration in ms before a last-known-position marker begins fading out. */
export const LAST_KNOWN_DECAY_MS = 3500;
