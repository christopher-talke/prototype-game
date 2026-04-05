import { getPlayerElement, ACTIVE_PLAYER } from '../Globals/Players';
import { recordKill } from './gameState';
import { createDefaultWeapon } from './weapons';
import { updateHealthBar, positionHealthBar } from '../Player/player';
import { getHealthBarElement } from '../Globals/Players';
import { getActiveMap } from '../Maps/helpers';

const ARMOR_ABSORPTION = 0.5;
const RESPAWN_TIME = 3000;

export function isPlayerDead(player: player_info): boolean {
    return player.dead;
}

export function applyDamage(target: player_info, rawDamage: number, attackerId: number) {
    if (isPlayerDead(target)) return;

    let remaining = rawDamage;

    if (target.armour > 0) {
        const absorbed = Math.min(rawDamage * ARMOR_ABSORPTION, target.armour);
        target.armour = Math.round(target.armour - absorbed);
        remaining = rawDamage - absorbed;
    }

    target.health = Math.round(target.health - remaining);

    if (target.health <= 0) {
        target.health = 0;
        killPlayer(target, attackerId);
    }

    updateHealthBar(target);
}

function killPlayer(target: player_info, killerId: number) {
    target.dead = true;

    const el = getPlayerElement(target.id);
    if (el) el.classList.add('dead');

    recordKill(killerId, target.id);

    setTimeout(() => {
        respawnPlayer(target);
    }, RESPAWN_TIME);
}

function respawnPlayer(target: player_info) {
    const teamSpawns = getActiveMap().teamSpawns;
    const spawnPoints = teamSpawns[target.team] ?? Object.values(teamSpawns).flat();
    const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

    target.health = 100;
    target.armour = 0;
    target.dead = false;
    target.current_position.x = spawn.x;
    target.current_position.y = spawn.y;

    // Reset to default pistol
    target.weapons = [createDefaultWeapon()];

    const el = getPlayerElement(target.id);
    if (el) {
        el.classList.remove('dead');
        el.style.transform = `translate3d(${spawn.x}px, ${spawn.y}px, 0) rotate(${target.current_position.rotation}deg)`;
        // Local player needs visible class restored - detection only runs for other players
        if (target.id === ACTIVE_PLAYER) {
            el.classList.add('visible');
        }
    }

    const wrap = getHealthBarElement(target.id);
    if (wrap) positionHealthBar(wrap, target);
    updateHealthBar(target);
}
