const PLAYERS = [] as player_info[];
const PLAYER_ELEMENTS = new Map<number, HTMLElement>();
const HEALTH_BAR_ELEMENTS = new Map<number, HTMLElement>();
export let ACTIVE_PLAYER = null as null | number

export function addPlayer(player_info: player_info) {
    const playerJoined = PLAYERS.find((p) => p.id === player_info.id);
    if (playerJoined === undefined) {
        PLAYERS.push(player_info)
    }
    return;
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
    return PLAYERS.filter(p => p.id !== excludeId);
}

export function getAllPlayers(): player_info[] {
    return PLAYERS;
}

export function getPlayerInfo(playerId: number) {
    return PLAYERS.find((p) => p.id === playerId);
}

export function setActivePlayer(playerId: number) {
    ACTIVE_PLAYER = playerId
}
