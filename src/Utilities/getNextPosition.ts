import { angleToRadians } from './angleToRadians';

export function getNextPosition(sourceX: number, sourceY: number, distance: number, angle: number): coordinates {
    return {
        x: sourceX + distance * Math.cos(angleToRadians(angle)),
        y: sourceY + distance * Math.sin(angleToRadians(angle)),
    };
}
