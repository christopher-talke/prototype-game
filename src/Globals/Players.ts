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

export function getOtherPlayers(excludeId: number): player_info[] {
    return PLAYERS.filter((p) => p.id !== excludeId);
}

export function getAllPlayers(): player_info[] {
    return PLAYERS;
}

export function getPlayerInfo(playerId: number) {
    return PLAYERS_MAP.get(playerId);
}

export function setActivePlayer(playerId: number) {
    if (ACTIVE_PLAYER != null) {
        const oldEl = PLAYER_ELEMENTS.get(ACTIVE_PLAYER);
        if (oldEl) oldEl.classList.remove('visible');
    }
    ACTIVE_PLAYER = playerId;
    const newEl = PLAYER_ELEMENTS.get(playerId);
    if (newEl) newEl.classList.add('visible');
}

export function clearAllPlayers() {
    for (const el of PLAYER_ELEMENTS.values()) el.remove();
    for (const el of HEALTH_BAR_ELEMENTS.values()) el.remove();
    PLAYERS.length = 0;
    PLAYERS_MAP.clear();
    PLAYER_ELEMENTS.clear();
    HEALTH_BAR_ELEMENTS.clear();
    ACTIVE_PLAYER = null;
}
