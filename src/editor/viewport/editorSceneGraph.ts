/**
 * Minimal scene graph for the editor viewport.
 *
 * Three world-scaled layers under a `worldContainer`:
 *   backgroundLayer - solid fill, grid
 *   contentLayer    - per-item map content via typed sublayers
 *   overlayLayer    - snap indicator, gizmos, selection box, drag preview
 *
 * The `worldContainer`'s position + scale are driven by the camera; all
 * child content uses world coordinates directly.
 *
 * Part of the editor layer.
 */

import { Container, type Application } from 'pixi.js';

export interface EditorContentSublayers {
    decal: Container;
    wall: Container;
    object: Container;
    entity: Container;
    light: Container;
    navHint: Container;
    zone: Container;
}

export interface EditorSceneGraph {
    worldContainer: Container;
    backgroundLayer: Container;
    contentLayer: Container;
    sublayers: EditorContentSublayers;
    overlayLayer: Container;
}

/** Build and attach the editor scene graph to the given Pixi Application. */
export function createEditorSceneGraph(app: Application): EditorSceneGraph {
    const worldContainer = new Container();
    worldContainer.label = 'editor.worldContainer';
    app.stage.addChild(worldContainer);

    const backgroundLayer = new Container();
    backgroundLayer.label = 'editor.backgroundLayer';
    worldContainer.addChild(backgroundLayer);

    const contentLayer = new Container();
    contentLayer.label = 'editor.contentLayer';
    worldContainer.addChild(contentLayer);

    const sublayers = createSublayers(contentLayer);

    const overlayLayer = new Container();
    overlayLayer.label = 'editor.overlayLayer';
    worldContainer.addChild(overlayLayer);

    return { worldContainer, backgroundLayer, contentLayer, sublayers, overlayLayer };
}

function createSublayers(parent: Container): EditorContentSublayers {
    const decal = mkSublayer('decal');
    const wall = mkSublayer('wall');
    const object = mkSublayer('object');
    const entity = mkSublayer('entity');
    const light = mkSublayer('light');
    const navHint = mkSublayer('navHint');
    const zone = mkSublayer('zone');
    parent.addChild(decal, wall, object, entity, light, navHint, zone);
    return { decal, wall, object, entity, light, navHint, zone };
}

function mkSublayer(name: string): Container {
    const c = new Container();
    c.label = `editor.sublayer.${name}`;
    return c;
}
