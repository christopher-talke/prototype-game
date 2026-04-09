export function getDistance(sx: number, sy: number, tx: number, ty: number) {
    const dx = tx - sx;
    const dy = ty - sy;

    return Math.sqrt(dx * dx + dy * dy);
}
