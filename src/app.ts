import { MAP_OFFSET } from './constants';

/** Root DOM element (`#app`). Undefined in non-browser environments (e.g. server). */
export const app = typeof document !== 'undefined' ? document.getElementById('app') as HTMLElement : undefined;
export { MAP_OFFSET };

const RENDERER_STORAGE_KEY = 'sightline-renderer';

function loadRendererSetting(): RendererType {
    try {
        const stored = localStorage.getItem(RENDERER_STORAGE_KEY);
        if (stored === 'dom' || stored === 'pixi') return stored;
    }
    catch { /* ignore */ }
    return 'pixi';
}

/**
 * Persists the chosen renderer backend to localStorage so it survives page reloads.
 * @param type - The renderer backend to save.
 */
export function saveRendererSetting(type: RendererType) {
    try { localStorage.setItem(RENDERER_STORAGE_KEY, type); }
    catch { /* ignore */ }
}

/** Global runtime settings. Initialized with defaults; mutated by menus and debug tools. */
export const SETTINGS: GameSettings = {
    debug: false,
    gameMode: 'tdm',
    renderer: loadRendererSetting(),
    raycast: {
        type: 'CORNERS',
    },
    audio: {
        masterVolume: 0.4,
        sfxVolume: 0.6,
        musicVolume: 0.5,
        muted: false,
    },
};
