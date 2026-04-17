/**
 * Creates the fog-of-war overlay element for the DOM renderer.
 * The overlay is clipped by the raycast visibility polygon via CSS clip-path,
 * updated each frame by raycastRenderer.
 */

import '@rendering/dom/css/fogOfWar.css';

import { app } from '../../app';
import { environment } from '@simulation/environment/environment';

/**
 * Creates and appends the fog-of-war div sized to the map bounds.
 * Must be called once after the environment is loaded.
 */
export function drawFogOfWar() {
    if (app === undefined) return;

    const el = window.document.createElement('div');
    el.id = `fog-of-war`;
    el.style.width = environment.limits.right + 'px';
    el.style.height = environment.limits.bottom + 'px';
    app.appendChild(el);
}
