const PLAYERS = [] as player_info[];
const PLAYERS_MAP = new Map<number, player_info>();
const PLAYER_ELEMENTS = new Map<number, HTMLElement>();
const HEALTH_BAR_ELEMENTS = new Map<number, HTMLElement>();
export let ACTIVE_PLAYER = null as null | number;

export function addPlayer(player_info: player_info) {
    if (!PLAYERS_MAP.has(player_info.id)) {
        PLAYERS.push(player_info);
        PLAYERS_MAP.set(player_info.id, player_info);
    }
}

export function registerPlayerElement(playerId: number, element: HTMLElement) {
    PLAYER_ELEMENTS.set(playerId, element);
}

export function getPlayerElement(playerId: number): HTMLElement | undefined {
    return PLAYER_ELEMENTS.get(playerId);
}

export function registerHealthBarElement(playerId: number, element: HTMLElement) {
    HEALTH_BAR_ELEMENTS.set(playerId, element);
}

export function getHealthBarElement(playerId: number): HTMLElement | undefined {
    return HEALTH_BAR_ELEMENTS.get(playerId);
}

export function* iterOtherPlayers(excludeId: number): Generator<player_info> {
    for (let i = 0; i < PLAYERS.length; i++) {
        if (PLAYERS[i].id !== excludeId) yield PLAYERS[i];
    }
}

export function getAllPlayers(): player_info[] {
    return PLAYERS;
}

export function getPlayerInfo(playerId: number) {
    return PLAYERS_MAP.get(playerId);
}

// Sets the active player and updates visibility class on the player element.
export function setActivePlayer(playerId: number) {
    if (ACTIVE_PLAYER != null) {
        PLAYER_ELEMENTS.get(ACTIVE_PLAYER)?.classList.remove('visible');
    }
    ACTIVE_PLAYER = playerId;
    PLAYER_ELEMENTS.get(playerId)?.classList.add('visible');
}

// Clears all player data. Rendering layer is responsible for removing DOM elements.
export function clearPlayerData() {
    PLAYERS.length = 0;
    PLAYERS_MAP.clear();
    PLAYER_ELEMENTS.clear();
    HEALTH_BAR_ELEMENTS.clear();
    ACTIVE_PLAYER = null;
}
