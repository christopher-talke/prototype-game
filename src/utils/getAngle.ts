export function getAngle(sx: number, sy: number, tx: number, ty: number): number {
    return (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
}
