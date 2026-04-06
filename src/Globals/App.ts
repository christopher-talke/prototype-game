import { MAP_OFFSET } from '../constants';

export const app = document.getElementById('app') as HTMLElement;
export { MAP_OFFSET };
export const SETTINGS: GameSettings = {
    debug: false,
    gameMode: 'tdm',
    raycast: {
        type: 'MAIN_THREAD',
    },
    audio: {
        masterVolume: 0.4,
        sfxVolume: 0.6,
        musicVolume: 0.5,
        muted: false,
    },
};
