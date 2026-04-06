import './style.css';

import { createPlayer, generatePlayers } from './Player/player';
import { setActivePlayer, clearAllPlayers, getAllPlayers } from './Globals/Players';
import { drawFogOfWar } from './Player/Raycast/fogOfWar';
import { drawCollisionOverlay } from './Environment/generateCollisionMap';
import { environment, generateEnvironment } from './Environment/environment';
import { createWall } from './Environment/Wall/wall';
import { MAP_OFFSET } from './constants';
import { initHUD, setOnReturnToMenuCallback, hideMatchEndOverlay } from './HUD/hud';
import { getActiveMap } from './Maps/helpers';
import { registerAI, clearAllAI } from './AI/ai';
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
import { initInteractivity } from './Player/interactivity';
import { gameEventBus } from './Net/GameEvent';
import { getLobbyState } from './Net/LobbyScreen';
import { createDefaultWeapon } from './Combat/weapons';

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

    setLoadingProgress(45, 'initializing input');
    initInteractivity();
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

    function spawnOfflinePlayers() {
        const config = getConfig();
        const players = generatePlayers(config.match.maxPlayers, config.match.teamsCount, ACTIVE_MAP.teamSpawns);
        for (const player of players) {
            createPlayer(player, player.id === 1);
            if (player.id !== 1) {
                registerAI(player);
            }
        }
        setActivePlayer(1);
        authSim.setPlayers(getAllPlayers());
    }

    function spawnOnlinePlayers() {
        const lobby = getLobbyState();
        if (!lobby) return;
        const localId = webSocketAdapter.getLocalPlayerId();
        for (const lp of lobby.players) {
            const spawns = ACTIVE_MAP.teamSpawns[lp.team] ?? Object.values(ACTIVE_MAP.teamSpawns).flat();
            const spawn = spawns[0];
            const info: player_info = {
                id: lp.id,
                name: lp.name,
                team: lp.team,
                current_position: { x: spawn.x, y: spawn.y, rotation: 0 },
                health: getConfig().player.maxHealth,
                armour: 0,
                dead: false,
                weapons: [createDefaultWeapon()],
                grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
            };
            createPlayer(info, lp.id === localId);
        }
    }

    function destroyAllPlayers() {
        clearAllAI();
        clearAllPlayers();
    }

    function launchMatch(modeId: string) {
        const entry = GAME_MODES_MAP.get(modeId);
        if (entry) setGameMode(entry.partial);
        stopMenuMusic();
        spawnOfflinePlayers();
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
        destroyAllPlayers();

        webSocketAdapter.onGameStart = () => {
            spawnOnlinePlayers();
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
        spawnOnlinePlayers();
        const localId = webSocketAdapter.getLocalPlayerId();
        if (localId) setActivePlayer(localId);
        setAdapter(webSocketAdapter);
        stopMenuMusic();
        document.body.style.cursor = 'none';
    };

    await hideLoadingScreen();
    showMainMenu(launchMatch);
});
