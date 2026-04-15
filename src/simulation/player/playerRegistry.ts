/**
 * Client-side player registry singletons.
 * Maintains the canonical list of all players and the local player's ID.
 * Consumed by rendering, detection, and UI layers for player lookups.
 *
 * Simulation layer - does not depend on rendering, net, or orchestration.
 */

const PLAYERS = [] as player_info[];
const PLAYERS_MAP = new Map<number, player_info>();

/** ID of the local player, or null if not yet assigned. */
export let ACTIVE_PLAYER = null as null | number;

/**
 * Registers a player in the global registry. No-op if the player ID already exists.
 * @param player_info - The player to register.
 */
export function addPlayer(player_info: player_info) {
    if (!PLAYERS_MAP.has(player_info.id)) {
        PLAYERS.push(player_info);
        PLAYERS_MAP.set(player_info.id, player_info);
    }
}

/**
 * Yields all players except the one with the given ID.
 * Used by detection to iterate potential visibility targets.
 * @param excludeId - Player ID to skip.
 */
export function* iterOtherPlayers(excludeId: number): Generator<player_info> {
    for (let i = 0; i < PLAYERS.length; i++) {
        if (PLAYERS[i].id !== excludeId) yield PLAYERS[i];
    }
}

/**
 * Returns the full player array. The returned reference is the live internal array.
 * @returns All registered players.
 */
export function getAllPlayers(): player_info[] {
    return PLAYERS;
}

/**
 * Looks up a player by ID.
 * @param playerId - The player ID to find.
 * @returns The player_info, or undefined if not found.
 */
export function getPlayerInfo(playerId: number) {
    return PLAYERS_MAP.get(playerId);
}

/**
 * Sets the local player's ID.
 * @param playerId - The ID to mark as the active (local) player.
 */
export function setActivePlayer(playerId: number) {
    ACTIVE_PLAYER = playerId;
}

/** Removes all players from the registry and clears the active player. */
export function clearPlayerRegistry() {
    PLAYERS.length = 0;
    PLAYERS_MAP.clear();
    ACTIVE_PLAYER = null;
}
