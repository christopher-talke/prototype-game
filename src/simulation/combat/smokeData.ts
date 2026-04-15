/**
 * Tracks active smoke clouds for line-of-sight blocking.
 * Smoke data is registered when a SMOKE_DEPLOY event fires and expires after its duration.
 * Consumed by the detection layer's raycast module to block LOS through smoke.
 *
 * Simulation layer - does not depend on rendering, net, or orchestration.
 */

/** A single active smoke cloud with position, radius, and expiration time. */
type SmokeData = {
    x: number;
    y: number;
    radius: number;
    expiresAt: number;
};

const smokeDatas: SmokeData[] = [];

/**
 * Registers a new smoke cloud.
 * @param x - Center x of the smoke.
 * @param y - Center y of the smoke.
 * @param radius - Radius of the smoke cloud.
 * @param duration - How long the smoke lasts in ms.
 * @param timestamp - Current simulation time.
 */
export function addSmokeData(x: number, y: number, radius: number, duration: number, timestamp: number) {
    smokeDatas.push({
        x,
        y,
        radius,
        expiresAt: timestamp + duration,
    });
}

/**
 * Removes smoke clouds that have exceeded their duration.
 * @param timestamp - Current simulation time.
 */
export function removeExpiredSmoke(timestamp: number) {
    for (let i = smokeDatas.length - 1; i >= 0; i--) {
        if (timestamp >= smokeDatas[i].expiresAt) {
            smokeDatas.splice(i, 1);
        }
    }
}

/** Removes all smoke data. Called on round/match reset. */
export function clearAllSmokeData() {
    smokeDatas.length = 0;
}

/**
 * Checks if the line segment from (x1,y1) to (x2,y2) passes through any active smoke cloud.
 * @param x1 - Start x.
 * @param y1 - Start y.
 * @param x2 - End x.
 * @param y2 - End y.
 * @returns True if the line intersects any smoke cloud.
 */
export function isSmoked(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const data of smokeDatas) {
        if (lineIntersectsCircle(x1, y1, x2, y2, data.x, data.y, data.radius)) {
            return true;
        }
    }
    return false;
}

/**
 * Tests whether a line segment intersects a circle using the quadratic formula
 * on the parametric ray-circle distance equation.
 * @param x1 - Segment start x.
 * @param y1 - Segment start y.
 * @param x2 - Segment end x.
 * @param y2 - Segment end y.
 * @param cx - Circle center x.
 * @param cy - Circle center y.
 * @param r - Circle radius.
 * @returns True if the segment intersects the circle.
 */
function lineIntersectsCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    if (a < 1e-10) {
        return fx * fx + fy * fy <= r * r;
    }

    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}
