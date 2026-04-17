/**
 * Design constants for the 2D lighting system: ambient scene level,
 * per-player light radii/intensities, FOV cone parameters, and
 * last-known-position ghost lights.
 */
export const lightingConfig = {
    ambientLevel: 0.4,
    ambientColor: 0x080814,
    falloffExponent: 3.5,
    coreSharpness: 0.06,

    playerRadius: 200,
    playerIntensity: 1.4,
    fovRadius: 1100,
    fovIntensity: 2.5,
    fovSoftEdge: 8,

    lastKnownRadius: 160,
    lastKnownIntensity: 1.5,
};
