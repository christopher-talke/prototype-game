export function getActiveWeapon(playerInfo: player_info): PlayerWeapon | undefined {
    return playerInfo.weapons.find((w) => w.active);
}
