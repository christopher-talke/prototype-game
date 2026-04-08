import { createPlayer, generatePlayers } from '../Player/player';
import { setActivePlayer, getAllPlayers } from '../Globals/Players';
import { clientRenderer } from '../Net/ClientRenderer';
import { registerAI, clearAllAI } from '../AI/ai';
import { getConfig, setGameMode } from '../Config/activeConfig';
import { GAME_MODES_MAP } from '../Config/modes/index';
import { offlineAdapter } from '../Net/OfflineAdapter';
import { getAdapter, setAdapter } from '../Net/activeAdapter';
import { webSocketAdapter } from '../Net/WebSocketAdapter';
import { getWallAABBs } from '../Player/collision';
import { gameEventBus } from '../Net/GameEvent';
import { getLobbyState } from '../Net/LobbyScreen';
import { createDefaultWeapon } from '../Combat/weapons';
import { environment } from '../Environment/environment';
import { getActiveMap } from '../Maps/helpers';
import { stopMenuMusic, playMenuMusic } from '../Audio/audio';
import { hideMainMenu, showMainMenu } from '../MainMenu/MainMenu';
import { setOnReturnToMenuCallback, hideMatchEndOverlay } from '../HUD/hud';

const ACTIVE_MAP = getActiveMap();
const authSim = offlineAdapter.authSim;

export function initMatchSystem() {
    authSim.setMap(
        [...getWallAABBs()],
        { ...environment.limits },
        [...environment.segments],
        ACTIVE_MAP.teamSpawns,
        ACTIVE_MAP.patrolPoints,
    );

    setOnReturnToMenuCallback(returnToMenu);

    webSocketAdapter.onGameStart = () => {
        spawnOnlinePlayers();
        const localId = webSocketAdapter.getLocalPlayerId();
        if (localId) setActivePlayer(localId);
        setAdapter(webSocketAdapter);
        stopMenuMusic();
        document.body.style.cursor = 'none';
    };

    webSocketAdapter.onPlayerJoined = (snapshot) => {
        const info: player_info = {
            id: snapshot.id,
            name: snapshot.name,
            team: snapshot.team,
            current_position: { x: snapshot.x, y: snapshot.y, rotation: snapshot.rotation },
            health: snapshot.health,
            armour: snapshot.armour,
            dead: snapshot.dead,
            weapons: snapshot.weapons,
            grenades: snapshot.grenades,
        };
        createPlayer(info, false);
    };
}

function spawnOfflinePlayers() {
    const config = getConfig();

    console.log(`fnc: spawnOfflinePlayers", config:`, config);
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
    const localId = webSocketAdapter.getLocalPlayerId();

    const lateJoinPlayers = webSocketAdapter.getLateJoinPlayers();
    if (lateJoinPlayers) {
        for (const sp of lateJoinPlayers) {
            const info: player_info = {
                id: sp.id,
                name: sp.name,
                team: sp.team,
                current_position: { x: sp.x, y: sp.y, rotation: sp.rotation },
                health: sp.health,
                armour: sp.armour,
                dead: sp.dead,
                weapons: sp.weapons,
                grenades: sp.grenades,
            };
            createPlayer(info, sp.id === localId);
        }
        return;
    }

    const lobby = getLobbyState();
    if (!lobby) return;
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
    clientRenderer.clearPlayers();
}

export function launchMatch(modeId: string) {
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
