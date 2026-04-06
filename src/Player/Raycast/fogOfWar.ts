import './fogOfWar.css';

import { environment } from '../../Environment/environment';
import { app } from '../../main';

export function drawFogOfWar() {
    const newFowEntity = window.document.createElement('div');

    newFowEntity.id = `fog-of-war`;
    newFowEntity.style.width = environment.limits.right + 'px';
    newFowEntity.style.height = environment.limits.bottom + 'px';

    app.appendChild(newFowEntity);
}
