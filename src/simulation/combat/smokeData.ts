type SmokeData = {
    x: number;
    y: number;
    radius: number;
    expiresAt: number;
};

const smokeDatas: SmokeData[] = [];

export function addSmokeData(x: number, y: number, radius: number, duration: number) {
    smokeDatas.push({
        x,
        y,
        radius,
        expiresAt: performance.now() + duration,
    });
}

export function removeExpiredSmoke(timestamp: number) {
    for (let i = smokeDatas.length - 1; i >= 0; i--) {
        if (timestamp >= smokeDatas[i].expiresAt) {
            smokeDatas.splice(i, 1);
        }
    }
}

export function isSmoked(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const data of smokeDatas) {
        if (lineIntersectsCircle(x1, y1, x2, y2, data.x, data.y, data.radius)) {
            return true;
        }
    }
    return false;
}

/**
 * Checks if a line segment intersects with a circle (algorithm adapted from https://stackoverflow.com/a/1088058)
 * - This sucked, and thank god for LLMs to help me get it right on the first try. I hate geometry (Sorry Mrs Ryan).
 * @param x1 The x-coordinate of the start of the line segment.
 * @param y1 The y-coordinate of the start of the line segment.
 * @param x2 The x-coordinate of the end of the line segment.
 * @param y2 The y-coordinate of the end of the line segment.
 * @param cx The x-coordinate of the circle's center.
 * @param cy The y-coordinate of the circle's center.
 * @param r The radius of the circle.
 * @returns True if the line segment intersects the circle, false otherwise.
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
