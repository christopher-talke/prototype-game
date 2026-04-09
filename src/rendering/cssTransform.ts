export function cssTransform(x: number, y: number, rotation?: number): string {
    if (rotation !== undefined) {
        return `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
    }
    return `translate3d(${x}px, ${y}px, 0)`;
}
