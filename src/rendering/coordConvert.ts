import { SETTINGS } from '../app';
import { MAP_OFFSET } from '../constants';
import { pixiScreenToWorld } from '@rendering/canvas/camera';

/**
 * Converts screen (client) coordinates to world coordinates,
 * using the appropriate method based on the active renderer.
 * @param clientX - Horizontal pixel position relative to the browser viewport.
 * @param clientY - Vertical pixel position relative to the browser viewport.
 * @returns World-space position `{x, y}`.
 */
export function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    if (SETTINGS.renderer === 'pixi') {
        return pixiScreenToWorld(clientX, clientY);
    }
    return {
        x: clientX + window.scrollX - MAP_OFFSET,
        y: clientY + window.scrollY - MAP_OFFSET,
    };
}
