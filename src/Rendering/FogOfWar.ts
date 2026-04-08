import '../Player/Raycast/fogOfWar.css';
import { environment } from '../Environment/environment';
import { app } from '../Globals/App';

export function drawFogOfWar() {
    const el = window.document.createElement('div');
    el.id = `fog-of-war`;
    el.style.width = environment.limits.right + 'px';
    el.style.height = environment.limits.bottom + 'px';
    app.appendChild(el);
}
