import { SETTINGS } from "../main";
import { removeElements } from "../Utilities/removeElements";

export function toggleSettings() {
    const settingsEl = document.getElementById('settings');
    settingsEl?.classList.toggle('d-none');
    return;
}

const debugInputEl = document.getElementById('debug') as HTMLSelectElement;
const raycastingInputEl = document.getElementById('raycasting') as HTMLSelectElement;

debugInputEl.addEventListener('change', () => {
    const debugSetting = debugInputEl.value;
    if (debugSetting === 'true') {
        SETTINGS.debug = true
    } else {
        removeElements(document.querySelectorAll('.ray'));
        removeElements(document.querySelectorAll('.los'));
        SETTINGS.debug = false
    }
    debugInputEl.blur();
})

raycastingInputEl.addEventListener('change', () => {
    const raycastSetting = raycastingInputEl.value;
    SETTINGS.raycast.type = raycastSetting

    if (raycastSetting === 'DISABLED') {
        removeElements(document.querySelectorAll('.ray'));
        document.getElementById('fog-of-war')?.classList.add('d-none')
    } else {
        document.getElementById('fog-of-war')?.classList.remove('d-none')
    }
    raycastingInputEl.blur();
})
