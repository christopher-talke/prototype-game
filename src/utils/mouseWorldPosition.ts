let mouseWorldX = 0;
let mouseWorldY = 0;

export function setMouseWorldPosition(x: number, y: number) {
    mouseWorldX = x;
    mouseWorldY = y;
}

export function getMouseWorldPosition(): { x: number; y: number } {
    return { x: mouseWorldX, y: mouseWorldY };
}
