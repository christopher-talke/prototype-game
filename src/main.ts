import './style.css';

import { createPlayer, generatePlayers } from './Player/player';
import { setActivePlayer } from './Globals/Players';
import { drawFogOfWar } from './Player/Raycast/fogOfWar';
import { drawCollisionOverlay } from './Environment/generateCollisionMap';
import { environment, generateEnvironment } from './Environment/environment';
import { createWall } from './Environment/Wall/wall';
import { MAP_OFFSET } from './constants';
import { initHUD, setOnReturnToMenuCallback, hideMatchEndOverlay } from './HUD/hud';
import { getActiveMap } from './Maps/helpers';
import { registerAI } from './AI/ai';
import { resumeAudioContext, playMenuMusic, stopMenuMusic } from './Audio/audio';
import { loadAllSounds } from './Audio/soundMap';
import { initProjectilePool } from './Combat/ProjectilePool';
import { clientRenderer } from './Net/ClientRenderer';
import { getConfig, setGameMode } from './Config/activeConfig';
import { showMainMenu, hideMainMenu } from './MainMenu/MainMenu';
import { GAME_MODES_MAP } from './Config/modes/index';
import { showLoadingScreen, setLoadingProgress, hideLoadingScreen } from './Loading/LoadingScreen';
import { offlineAdapter } from './Net/OfflineAdapter';
import { getAdapter, setAdapter } from './Net/activeAdapter';
import { webSocketAdapter } from './Net/WebSocketAdapter';
import { getWallAABBs } from './Player/collision';
import { getAllPlayers, getPlayerElement } from './Globals/Players';
import { gameEventBus } from './Net/GameEvent';

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

const ACTIVE_MAP = getActiveMap();
const config = getConfig();
const PLAYERS = generatePlayers(config.match.maxPlayers, config.match.teamsCount, ACTIVE_MAP.teamSpawns);

// Yield to browser so it can paint between heavy init steps
function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

document.addEventListener('DOMContentLoaded', async () => {
    showLoadingScreen();
    await nextFrame();

    setLoadingProgress(5, 'generating environment');
    generateEnvironment();
    await nextFrame();

    setLoadingProgress(15, 'drawing fog of war');
    drawFogOfWar();
    await nextFrame();

    setLoadingProgress(20, 'initializing systems');
    initProjectilePool();
    clientRenderer.init();

    setLoadingProgress(30, 'building walls');
    for (const wall of ACTIVE_MAP.walls) {
        createWall(wall);
    }
    await nextFrame();

    if (SETTINGS.debug) {
        drawCollisionOverlay(environment);
    }

    setLoadingProgress(45, 'creating players');
    for (const player of PLAYERS) {
        if (player.id === 1) {
            setActivePlayer(player.id);
        }
        createPlayer(player, player.id === 1);
        if (player.id !== 1) {
            registerAI(player);
        }
    }
    await nextFrame();

    setLoadingProgress(60, 'initializing hud');
    initHUD();
    await nextFrame();

    setLoadingProgress(70, 'loading sounds');
    await loadAllSounds();

    setLoadingProgress(100, 'ready');
    await nextFrame();

    resumeAudioContext();
    playMenuMusic();

    // Wire up AuthoritativeSimulation with map data after walls are built
    const authSim = offlineAdapter.authSim;
    authSim.setMap(
        [...getWallAABBs()],
        { ...environment.limits },
        [...environment.segments],
        ACTIVE_MAP.teamSpawns,
        ACTIVE_MAP.patrolPoints,
    );
    authSim.setPlayers(getAllPlayers());

    function launchMatch(modeId: string) {
        const entry = GAME_MODES_MAP.get(modeId);
        if (entry) setGameMode(entry.partial);
        stopMenuMusic();
        const playerIds = getAllPlayers().map((p) => p.id);
        authSim.initMatch(playerIds);
        const events = authSim.startRound();
        gameEventBus.emitAll(events);
        hideMainMenu();
        document.body.style.cursor = 'none';
    }

    function returnToMenu() {
        if (getAdapter().mode === 'online') {
            webSocketAdapter.disconnect();
            setAdapter(offlineAdapter);
        }

        authSim.endMatch();

        for (const player of getAllPlayers()) {
            player.dead = false;
            player.health = getConfig().player.maxHealth;
            player.armour = 0;
            const el = getPlayerElement(player.id);
            if (el) {
                el.classList.remove('dead');
                el.classList.remove('visible');
            }
        }

        setActivePlayer(1);

        webSocketAdapter.onGameStart = () => {
            const localId = webSocketAdapter.getLocalPlayerId();
            if (localId) setActivePlayer(localId);
            setAdapter(webSocketAdapter);
            stopMenuMusic();
            document.body.style.cursor = 'none';
        };

        hideMatchEndOverlay();
        document.body.style.cursor = 'auto';
        playMenuMusic();
        showMainMenu(launchMatch);
    }

    setOnReturnToMenuCallback(returnToMenu);

    // When the server signals game start, switch to online adapter
    webSocketAdapter.onGameStart = () => {
        const localId = webSocketAdapter.getLocalPlayerId();
        if (localId) setActivePlayer(localId);
        setAdapter(webSocketAdapter);
        stopMenuMusic();
        document.body.style.cursor = 'none';
    };

    await hideLoadingScreen();
    showMainMenu(launchMatch);
});
