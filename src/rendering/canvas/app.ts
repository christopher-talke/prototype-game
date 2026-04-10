import { Application } from 'pixi.js';
import { createSceneGraph } from './sceneGraph';

let pixiApp: Application | null = null;

export async function initPixiApp(): Promise<Application> {
    if (pixiApp) return pixiApp;

    pixiApp = new Application();
    await pixiApp.init({
        background: 0x0f0f1a,
        resolution: window.devicePixelRatio,
        autoDensity: true,
        resizeTo: window,
        antialias: true,
        preference: 'webgpu',
    });

    const canvas = pixiApp.canvas as HTMLCanvasElement;
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.zIndex = '0';
    document.body.appendChild(canvas);

    createSceneGraph(pixiApp.stage);

    return pixiApp;
}

export function getPixiApp(): Application | null {
    return pixiApp;
}

export function showPixiCanvas() {
    if (pixiApp) (pixiApp.canvas as HTMLCanvasElement).style.display = '';
}

export function hidePixiCanvas() {
    if (pixiApp) (pixiApp.canvas as HTMLCanvasElement).style.display = 'none';
}
