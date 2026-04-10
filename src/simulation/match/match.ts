import { registerAI, clearAllAI } from '@ai/index';

import { GAME_MODES_MAP } from '@config/modes/index';
import { getConfig, setGameMode } from '@config/activeConfig';
import type { DeepPartial, GameModeConfig } from '@config/types';

import { gameEventBus } from '@net/gameEvent';
import { offlineAdapter } from '@net/offlineAdapter';
import { webSocketAdapter } from '@net/webSocketAdapter';
import { getAdapter, setAdapter } from '@net/activeAdapter';

import { getLobbyState } from '@ui/lobby/lobbyScreen';
import { hideMainMenu, showMainMenu } from '@ui/mainMenu/mainMenu';

import { getActiveMap } from '@maps/helpers';

import { stopMenuMusic, playMenuMusic } from '@audio/index';

import { getWallAABBs } from '@simulation/player/collision';
import { createDefaultWeapon } from '@simulation/combat/weapons';
import { environment, setEnvironmentLimits } from '@simulation/environment/environment';
import { createDefaultGrenades } from '@simulation/combat/grenades';
import { registerWallGeometry, clearAllWallData } from '@simulation/environment/wallData';
import { generatePlayers, PlayerStatus } from '@simulation/player/playerData';
import { setActivePlayer, getAllPlayers, ACTIVE_PLAYER } from '@simulation/player/playerRegistry';

import { createPlayer } from '@rendering/dom/playerRenderer';
import { renderWall } from '@rendering/dom/wallRenderer';
import { clientRenderer } from '@rendering/dom/clientRenderer';
import { updateActivePlayerVisual } from '@rendering/playerElements';
import { setOnReturnToMenuCallback, hideMatchEndOverlay } from '@rendering/dom/hud';
import { SETTINGS } from '../../app';
import { renderPixiWalls, clearPixiWalls } from '@rendering/canvas/wallRenderer';
import { setWorldBounds } from '@rendering/canvas/sceneGraph';
import { pixiClientRenderer } from '@rendering/canvas/clientRenderer';

const authSim = offlineAdapter.authSim;

function loadMapWalls() {
    const map = getActiveMap();
    setEnvironmentLimits(map.bounds?.width ?? 3000, map.bounds?.height ?? 3000);
    clearAllWallData();
    clearPixiWalls();
    for (const wall of map.walls) {
        registerWallGeometry(wall);
        if (SETTINGS.renderer === 'dom') renderWall(wall);
    }
    if (SETTINGS.renderer === 'pixi') {
        const w = environment.limits.right;
        const h = environment.limits.bottom;
        setWorldBounds(w, h);
        renderPixiWalls(map.walls);
    }
}

function syncMapToSim() {
    const map = getActiveMap();
    authSim.setMap(
        [...getWallAABBs()],
        { ...environment.limits },
        [...environment.segments],
        map.teamSpawns,
        map.patrolPoints,
    );
}

export function initMatchSystem() {
    setOnReturnToMenuCallback(returnToMenu);

    webSocketAdapter.onGameStart = () => {
        loadMapWalls();
        syncMapToSim();
        spawnOnlinePlayers();
        const localId = webSocketAdapter.getLocalPlayerId();
        if (localId) {
            const oldId = ACTIVE_PLAYER;
            setActivePlayer(localId);
            updateActivePlayerVisual(oldId, localId);
        }
        setAdapter(webSocketAdapter);
        stopMenuMusic();
    };

    webSocketAdapter.onPlayerJoined = (snapshot) => {
        const info: player_info = {
            id: snapshot.id,
            name: snapshot.name,
            team: snapshot.team,
            current_position: { x: snapshot.x, y: snapshot.y, rotation: snapshot.rotation },
            status: PlayerStatus.IDLE,
            health: snapshot.health,
            armour: snapshot.armour,
            dead: snapshot.dead,
            weapons: snapshot.weapons,
            grenades: snapshot.grenades,
        };
        const localId = webSocketAdapter.getLocalPlayerId();
        const localPlayer = localId != null ? getAllPlayers().find(p => p.id === localId) : undefined;
        createPlayer(info, false, localPlayer?.team);
    };
}

function spawnOfflinePlayers() {
    const config = getConfig();

    const players = generatePlayers(config.match.maxPlayers, config.match.teamsCount, getActiveMap().teamSpawns);
    const localTeam = players.find(p => p.id === 1)?.team;
    for (const player of players) {
        createPlayer(player, player.id === 1, localTeam);
        if (player.id !== 1) {
            registerAI(player);
        }
    }

    setActivePlayer(1);
    updateActivePlayerVisual(null, 1);
    authSim.setPlayers(getAllPlayers());
}

function spawnOnlinePlayers() {
    const localId = webSocketAdapter.getLocalPlayerId();

    const lateJoinPlayers = webSocketAdapter.getLateJoinPlayers();
    if (lateJoinPlayers) {
        const localTeam = lateJoinPlayers.find(sp => sp.id === localId)?.team;
        for (const sp of lateJoinPlayers) {
            const info: player_info = {
                id: sp.id,
                name: sp.name,
                team: sp.team,
                current_position: { x: sp.x, y: sp.y, rotation: sp.rotation },
                status: PlayerStatus.IDLE,
                health: sp.health,
                armour: sp.armour,
                dead: sp.dead,
                weapons: sp.weapons,
                grenades: sp.grenades,
            };
            createPlayer(info, sp.id === localId, localTeam);
        }
        return;
    }

    const lobby = getLobbyState();
    if (!lobby) return;
    const localTeam = lobby.players.find(lp => lp.id === localId)?.team;
    for (const lp of lobby.players) {
        const spawns = getActiveMap().teamSpawns[lp.team] ?? Object.values(getActiveMap().teamSpawns).flat();
        const spawn = spawns[0];
        const info: player_info = {
            id: lp.id,
            name: lp.name,
            team: lp.team,
            current_position: { x: spawn.x, y: spawn.y, rotation: 0 },
            status: PlayerStatus.IDLE,
            health: getConfig().player.maxHealth,
            armour: 0,
            dead: false,
            weapons: [createDefaultWeapon()],
            grenades: createDefaultGrenades(),
        };
        createPlayer(info, lp.id === localId, localTeam);
    }
}

function destroyAllPlayers() {
    clearAllAI();
    if (SETTINGS.renderer === 'pixi') {
        pixiClientRenderer.clearPlayers();
    } else {
        clientRenderer.clearPlayers();
    }
}

export function launchMatch(modeId: string, overrides?: DeepPartial<GameModeConfig>) {
    const entry = GAME_MODES_MAP.get(modeId);
    if (entry) setGameMode(entry.partial);
    if (overrides) setGameMode(overrides);

    loadMapWalls();
    syncMapToSim();

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
    clearAllWallData();
    if (SETTINGS.renderer === 'pixi') clearPixiWalls();

    webSocketAdapter.onGameStart = () => {
        loadMapWalls();
        syncMapToSim();
        spawnOnlinePlayers();
        const localId = webSocketAdapter.getLocalPlayerId();
        if (localId) {
            const oldId = ACTIVE_PLAYER;
            setActivePlayer(localId);
            updateActivePlayerVisual(oldId, localId);
        }
        setAdapter(webSocketAdapter);
        stopMenuMusic();
    };

    hideMatchEndOverlay();

    playMenuMusic();
    showMainMenu(launchMatch);
}
