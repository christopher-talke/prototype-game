/**
 * Match lifecycle management - start, round transitions, and return to menu.
 *
 * Orchestration layer - coordinates between the simulation, net adapters, AI,
 * rendering, and UI to manage the full match lifecycle. Handles offline
 * (local with AI) and online (WebSocket) match flows.
 */

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

import { getActiveMap, getActiveMapId } from '@maps/helpers';

import { stopMenuMusic, playMenuMusic } from '@audio/index';

import { getWallAABBs } from '@simulation/player/collision';
import { createDefaultWeapon } from '@simulation/combat/weapons';
import { environment, setEnvironmentLimits } from '@simulation/environment/environment';
import { createDefaultGrenades } from '@simulation/combat/grenades';
import { registerWallGeometry, clearAllWallData } from '@simulation/environment/wallData';
import { generatePlayers, PlayerStatus } from '@simulation/player/playerData';
import { setActivePlayer, getAllPlayers, ACTIVE_PLAYER, clearPlayerRegistry } from '@simulation/player/playerRegistry';

import { createPlayer } from '@rendering/dom/playerRenderer';
import { renderWall, clearRenderedWalls } from '@rendering/dom/wallRenderer';
import { clientRenderer } from '@rendering/dom/clientRenderer';
import { updateActivePlayerVisual } from '@rendering/playerElements';
import { setOnReturnToMenuCallback, hideMatchEndOverlay } from '@rendering/dom/hud';
import { SETTINGS } from '../app';
import { renderPixiWalls, clearPixiWalls } from '@rendering/canvas/wallRenderer';
import { setWorldBounds } from '@rendering/canvas/sceneGraph';
import { pixiClientRenderer } from '@rendering/canvas/clientRenderer';
import { initLighting, clearLighting } from '@rendering/canvas/lightingManager';
import { clearGridDisplacement } from '@rendering/canvas/gridDisplacement';
import { initGridTextures, clearGridTextures } from '@rendering/canvas/gridTextures';
import { initGloss, clearGloss } from '@rendering/canvas/effects/glossEffect';

const authSim = offlineAdapter.authSim;

/**
 * Loads the active map's walls into the environment, clears previous wall
 * geometry, and renders walls via the current renderer. For the Pixi
 * renderer also initializes lighting, grid textures, and gloss.
 */
function loadMapWalls() {
    const map = getActiveMap();
    setEnvironmentLimits(map.bounds?.width ?? 3000, map.bounds?.height ?? 3000);
    clearAllWallData();
    clearRenderedWalls();
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
        initLighting(map.lights ?? [], map.walls, map.lighting);
        initGridTextures(getActiveMapId(), map.textureLayers);
        initGloss(map.gloss);
    }
}

/**
 * Pushes the current map's wall AABBs, segments, spawn points, and patrol
 * points into the authoritative simulation so it can run collision and
 * grenade physics.
 */
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

/**
 * Initializes the match system by wiring up the return-to-menu callback
 * and the WebSocket adapter's game-start and player-joined hooks.
 * Should be called once at application startup.
 */
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

/**
 * Spawns all players for an offline match. Player 1 is the local human;
 * all others get AI controllers registered.
 */
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

/**
 * Spawns players for an online match. Uses late-join snapshot data if
 * available (player joined a match in progress), otherwise falls back
 * to lobby state to build player_info objects.
 */
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

/**
 * Removes all player visuals from whichever renderer is active, clears
 * AI controllers, and empties the player registry.
 */
function destroyAllPlayers() {
    clearAllAI();
    if (SETTINGS.renderer === 'pixi') {
        pixiClientRenderer.clearPlayers();
    }

    else {
        clientRenderer.clearPlayers();
    }
    clearPlayerRegistry();
}

/**
 * Launches an offline match with the given game mode and optional config
 * overrides. Loads the map, spawns players with AI, initializes the
 * simulation match, starts the first round, hides the main menu, and
 * hides the cursor.
 * @param modeId - Key into GAME_MODES_MAP for the desired game mode.
 * @param overrides - Optional partial config merged on top of the mode defaults.
 */
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

/**
 * Ends the current match, tears down all players and environment state,
 * and returns to the main menu. For online matches, disconnects the
 * WebSocket and switches back to the offline adapter.
 */
function returnToMenu() {
    if (getAdapter().mode === 'online') {
        webSocketAdapter.disconnect();
        setAdapter(offlineAdapter);
    }

    authSim.endMatch();
    destroyAllPlayers();
    clearAllWallData();
    clearRenderedWalls();
    if (SETTINGS.renderer === 'pixi') {
        clearPixiWalls();
        clearLighting();
        clearGridDisplacement();
        clearGridTextures();
        clearGloss();
    }

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
