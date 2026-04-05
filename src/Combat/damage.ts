import { getPlayerElement, ACTIVE_PLAYER, getPlayerInfo } from '../Globals/Players';
import { recordKill } from './gameState';
import { updateHealthBar, positionHealthBar } from '../Player/player';
import { getHealthBarElement } from '../Globals/Players';
import { removeLastKnownForPlayer } from '../Player/lineOfSight';
import { playSoundAtPlayer } from '../Audio/audio';
import { simulation } from '../Net/GameSimulation';
import { gameEventBus, type GameEvent } from '../Net/GameEvent';

const RESPAWN_TIME = 3000;
const HEALTH_BAR_VISIBLE_DURATION = 3000;

const healthBarTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function isPlayerDead(player: player_info): boolean {
    return player.dead;
}

// Called directly when something outside the simulation tick needs to deal damage.
// When damage comes from simulation.tickProjectiles/tickGrenades, use
// renderDamageEvents() on the returned events instead.
export function applyDamage(target: player_info, rawDamage: number, attackerId: number) {
    const events = simulation.applyDamage(target, rawDamage, attackerId);
    renderDamageEvents(events);
    gameEventBus.emitAll(events);
}

// Render the PLAYER_DAMAGED and PLAYER_KILLED events from any source
// (bullet hits, explosions, direct damage, etc.)
export function renderDamageEvents(events: GameEvent[]) {
    for (const event of events) {
        switch (event.type) {
            case 'PLAYER_DAMAGED': {
                const target = getPlayerInfo(event.targetId);
                if (!target) break;
                if (target.health > 0) {
                    playSoundAtPlayer('hit', target);
                }
                updateHealthBar(target);
                showHealthBarTemporarily(target.id);
                break;
            }
            case 'PLAYER_KILLED': {
                const target = getPlayerInfo(event.targetId);
                if (!target) break;
                handleKillRendering(target, event.killerId);
                break;
            }
        }
    }
}

function showHealthBarTemporarily(playerId: number) {
    const wrap = getHealthBarElement(playerId);
    if (!wrap) return;
    wrap.classList.add('health-visible');
    const prev = healthBarTimers.get(playerId);
    if (prev) clearTimeout(prev);
    healthBarTimers.set(playerId, setTimeout(() => {
        wrap.classList.remove('health-visible');
        healthBarTimers.delete(playerId);
    }, HEALTH_BAR_VISIBLE_DURATION));
}

function handleKillRendering(target: player_info, killerId: number) {
    playSoundAtPlayer('death', target);

    const el = getPlayerElement(target.id);
    if (el) el.classList.add('dead');

    removeLastKnownForPlayer(target.id);
    recordKill(killerId, target.id);

    setTimeout(() => {
        respawnPlayer(target);
    }, RESPAWN_TIME);
}

function respawnPlayer(target: player_info) {
    const events = simulation.respawnPlayer(target);

    const el = getPlayerElement(target.id);
    if (el) {
        el.classList.remove('dead');
        el.style.transform = `translate3d(${target.current_position.x}px, ${target.current_position.y}px, 0) rotate(${target.current_position.rotation}deg)`;
        if (target.id === ACTIVE_PLAYER) {
            el.classList.add('visible');
        }
    }

    const wrap = getHealthBarElement(target.id);
    if (wrap) positionHealthBar(wrap, target);
    updateHealthBar(target);

    gameEventBus.emitAll(events);
}
