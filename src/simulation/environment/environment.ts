/**
 * Module-scope singleton holding the active map's world bounds and collision
 * geometry.
 *
 * Layer: simulation - environment sub-domain.
 * Consumed by: `detection/`, `player/visibility`, `rendering/` (read-only).
 * Written by: `wallData.ts` and `setEnvironmentLimits` at map load time.
 */
export const environment = {
    limits: {
        left: 0,
        right: 3000,
        top: 0,
        bottom: 3000,
    },
    segments: [],
    corners: [],
} as Environment;

/**
 * Constructs a `WallSegment` with precomputed AABB fields for broad-phase
 * culling.
 *
 * @param x1 - Segment start x.
 * @param y1 - Segment start y.
 * @param x2 - Segment end x.
 * @param y2 - Segment end y.
 * @returns A fully populated `WallSegment`.
 */
export function makeSegment(x1: number, y1: number, x2: number, y2: number): WallSegment {
    return {
        x1, y1, x2, y2,
        minX: Math.min(x1, x2), minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2), maxY: Math.max(y1, y2),
    };
}

/**
 * Rebuilds `environment.segments` and `environment.corners` from the current
 * `environment.limits`, producing the four boundary walls of the play area.
 *
 * Called once on startup and again whenever the world dimensions change.
 */
export function generateEnvironment() {
    const { left, right, top, bottom } = environment.limits;

    environment.segments = [
        makeSegment(left, top, right, top),
        makeSegment(right, top, right, bottom),
        makeSegment(right, bottom, left, bottom),
        makeSegment(left, bottom, left, top),
    ];

    environment.corners = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
    ];
}

/**
 * Updates the world dimensions and regenerates environment geometry.
 *
 * @param width - New world width in pixels.
 * @param height - New world height in pixels.
 */
export function setEnvironmentLimits(width: number, height: number) {
    environment.limits.right = width;
    environment.limits.bottom = height;
    generateEnvironment();
}

/** Resets wall geometry to the boundary-only state produced by `generateEnvironment`. */
export function clearWallGeometry() {
    generateEnvironment();
}
