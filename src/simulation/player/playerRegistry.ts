const PLAYERS = [] as player_info[];
const PLAYERS_MAP = new Map<number, player_info>();
export let ACTIVE_PLAYER = null as null | number;

export function addPlayer(player_info: player_info) {
    if (!PLAYERS_MAP.has(player_info.id)) {
        PLAYERS.push(player_info);
        PLAYERS_MAP.set(player_info.id, player_info);
    }
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

export function setActivePlayer(playerId: number) {
    ACTIVE_PLAYER = playerId;
}

export function clearPlayerRegistry() {
    PLAYERS.length = 0;
    PLAYERS_MAP.clear();
    ACTIVE_PLAYER = null;
}
