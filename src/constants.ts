/** Full width/height of the square player collision hitbox in world units. */
export const PLAYER_HIT_BOX = 44;

/** Half the player hitbox size - used for center-to-edge offset calculations. */
export const HALF_HIT_BOX = PLAYER_HIT_BOX / 2;

/** Player field-of-view cone half-angle in degrees. */
export const FOV = 55;

/** Degrees to rotate the FOV cone so 0 degrees points "forward" (screen-up). */
export const ROTATION_OFFSET = 90;

/** Tiny angular nudge (degrees) added to corner rays to avoid tangent-line edge cases. */
export const CORNER_RAY_OFFSET_DEGREES = 0.01;

/** Default square map side length in world units. Overridden by per-map bounds. */
export const MAP_SIZE = 3000;

/** Half the default map size - used as the origin offset for centered coordinate systems. */
export const MAP_OFFSET = 1500;
