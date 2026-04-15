/**
 * Returns the currently active weapon for a player.
 * @param playerInfo - The player to check.
 * @returns The active PlayerWeapon, or undefined if none is active.
 */
export function getActiveWeapon(playerInfo: player_info): PlayerWeapon | undefined {
    return playerInfo.weapons.find((w) => w.active);
}
