/**
 * PixiJS Application singleton.
 *
 * Initializes the PixiJS v8 Application, attaches the canvas to the DOM,
 * and builds the scene graph. Other canvas sub-systems import the app
 * instance via {@link getPixiApp}.
 *
 * Part of the canvas rendering layer.
 */

import { Application } from 'pixi.js';

import { createSceneGraph } from './sceneGraph';
import { BACKGROUND_COLOR } from './renderConstants';
import { getGraphicsConfig } from './config/graphicsConfig';

let pixiApp: Application | null = null;

/**
 * Create and initialize the PixiJS Application if it does not already exist.
 * Appends the WebGL canvas to `document.body` and builds the scene graph.
 * @returns The initialized Application instance.
 */
export async function initPixiApp(): Promise<Application> {
    if (pixiApp) return pixiApp;

    const gc = getGraphicsConfig();
    pixiApp = new Application();
    await pixiApp.init({
        background: BACKGROUND_COLOR,
        resolution: gc.resolution,
        autoDensity: true,
        resizeTo: window,
        antialias: gc.antialias,
        preference: 'webgl',
    });

    const canvas = pixiApp.canvas as HTMLCanvasElement;
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.zIndex = '0';
    document.body.appendChild(canvas);

    createSceneGraph(pixiApp.stage);

    return pixiApp;
}

/** Return the PixiJS Application instance, or null if not yet initialized. */
export function getPixiApp(): Application | null {
    return pixiApp;
}

/** Make the PixiJS canvas visible (undo a previous {@link hidePixiCanvas} call). */
export function showPixiCanvas() {
    if (pixiApp) (pixiApp.canvas as HTMLCanvasElement).style.display = '';
}

/** Hide the PixiJS canvas without destroying it, used when switching to the DOM renderer. */
export function hidePixiCanvas() {
    if (pixiApp) (pixiApp.canvas as HTMLCanvasElement).style.display = 'none';
}
