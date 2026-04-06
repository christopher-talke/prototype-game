import './fogOfWar.css';

import { environment } from '../../Environment/environment';
import { app } from '../../main';

/**
 * Draws the fog of war overlay on the game map. 
 * This function creates a new HTML element that covers the entire game area and applies the appropriate styles to represent the fog of war. 
 * The fog of war will be updated dynamically based on player visibility and line of sight.
 * This function is responsible for the initial creation and rendering of the fog layer.
 */
export function drawFogOfWar() {
    const newFowEntity = window.document.createElement('div');

    newFowEntity.id = `fog-of-war`;
    newFowEntity.style.width = environment.limits.right + 'px';
    newFowEntity.style.height = environment.limits.bottom + 'px';

    app.appendChild(newFowEntity);
}
