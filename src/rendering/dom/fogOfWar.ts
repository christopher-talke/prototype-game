import '@rendering/dom/css/fogOfWar.css';
import { app } from '../../app';
import { environment } from '@simulation/environment/environment';

export function drawFogOfWar() {
    if (app === undefined) return;

    const el = window.document.createElement('div');
    el.id = `fog-of-war`;
    el.style.width = environment.limits.right + 'px';
    el.style.height = environment.limits.bottom + 'px';
    app.appendChild(el);
}
