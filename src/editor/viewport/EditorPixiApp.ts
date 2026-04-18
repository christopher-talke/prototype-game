/**
 * Editor-owned PixiJS Application.
 *
 * Independent of the game's renderer singleton. Mounts its own canvas into
 * `#editor-viewport` and resizes to that container via ResizeObserver. The
 * editor camera drives the `worldContainer` transform every frame.
 *
 * Part of the editor layer.
 */

import { Application } from 'pixi.js';

import { type EditorSceneGraph, createEditorSceneGraph } from './editorSceneGraph';
import type { EditorCamera } from './EditorCamera';

export interface EditorPixiContext {
    app: Application;
    scene: EditorSceneGraph;
    canvas: HTMLCanvasElement;
}

/** Create the editor's PixiJS Application and mount its canvas into `container`. */
export async function initEditorPixi(
    container: HTMLElement,
    camera: EditorCamera,
): Promise<EditorPixiContext> {
    const app = new Application();
    await app.init({
        background: 0x1a1a22,
        antialias: true,
        resolution: window.devicePixelRatio ?? 1,
        autoDensity: true,
        resizeTo: container,
        preference: 'webgl',
    });

    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const scene = createEditorSceneGraph(app);

    const syncSize = () => {
        const rect = container.getBoundingClientRect();
        camera.setViewportSize(rect.width, rect.height);
    };
    syncSize();

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(container);

    app.ticker.add(() => {
        scene.worldContainer.scale.set(camera.zoom);
        scene.worldContainer.x = Math.round(-camera.x * camera.zoom);
        scene.worldContainer.y = Math.round(-camera.y * camera.zoom);
    });

    return { app, scene, canvas };
}
