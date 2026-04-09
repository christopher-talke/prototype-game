import './fogOfWar.css';
import { environment } from '@simulation/environment/environment';
import { app } from '../app';

export function drawFogOfWar() {
    const el = window.document.createElement('div');
    el.id = `fog-of-war`;
    el.style.width = environment.limits.right + 'px';
    el.style.height = environment.limits.bottom + 'px';
    app.appendChild(el);
}
