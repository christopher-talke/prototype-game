import { getAngle } from '../utils/getAngle';
import { getDistance } from '../utils/getDistance';
import { normalizeAngle } from '@utils/normalizeAngle';
import { isLineBlocked } from '@simulation/detection/raycast';
import { environment } from '@simulation/environment/environment';
import { isPlayerDead } from '@simulation/combat/damage';
import { getActiveWeapon } from '@simulation/combat/shooting';
import { getWeaponDef, isWeaponAllowed } from '@simulation/combat/weapons';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { getConfig } from '@config/activeConfig';
import { getActiveMap } from '@maps/helpers';
import { offlineAdapter } from '@net/OfflineAdapter';
import { getGrenadeDef, isGrenadeAllowed } from '@simulation/combat/grenades';

const STUCK_THRESHOLD = 0.5;
const STUCK_FRAMES_BEFORE_REROUTE = 15;
const UNSTICK_DURATION = 600;
const WALL_CHECK_SHOTS = 5;

const BUY_PRIORITY = ['SMG', 'RIFLE', 'SHOTGUN', 'SNIPER'];

type AIState = 'patrol' | 'chase' | 'search';

type AIController = {
    player: player_info;
    state: AIState;
    waypoints: coordinates[];
    waypointIndex: number;
    lastSawTarget: number;
    targetId: number | null;
    targetLastPos: coordinates | null;
    patrolPauseUntil: number;
    lastFireTime: number;
    // Stuck detection
    lastPos: coordinates;
    stuckFrames: number;
    unstickUntil: number;
    unstickAngle: number;
    // Wall-hit tracking: stop firing when bullets keep hitting walls
    wallHitShots: number;
    hasBought: boolean;
    // LOS throttle: cached enemy scan result
    cachedEnemy: player_info | null;
    cachedEnemyDist: number;
    losFrame: number;
};

const controllers: AIController[] = [];
let aiFrameCounter = 0;
const AI_LOS_INTERVAL = 3; // only scan LOS every N frames per AI

function generatePatrolPoints(): coordinates[] {
    const points: coordinates[] = [];

    const currentMap = getActiveMap();
    if (currentMap.patrolPoints.length > 0) {
        points.push(...currentMap.patrolPoints);
    }
    
    const margin = 300;
    const mapMin = 200;
    const mapMax = 2700;
    if (points.length === 0) {

        for (let i = 0; i < 6; i++) {
            const newPoint = {
                x: mapMin + margin + Math.random() * (mapMax - mapMin - margin * 2),
                y: mapMin + margin + Math.random() * (mapMax - mapMin - margin * 2),
            }

            points.push(newPoint);
        }
    }

    return points;
}

export function clearAllAI() {
    controllers.length = 0;
}

export function registerAI(player: player_info) {
    controllers.push({
        player,
        state: 'patrol',
        waypoints: generatePatrolPoints(),
        waypointIndex: 0,
        lastSawTarget: 0,
        targetId: null,
        targetLastPos: null,
        patrolPauseUntil: 0,
        lastFireTime: 0,
        lastPos: { x: player.current_position.x, y: player.current_position.y },
        stuckFrames: 0,
        unstickUntil: 0,
        unstickAngle: 0,
        wallHitShots: 0,
        hasBought: false,
        cachedEnemy: null,
        cachedEnemyDist: Infinity,
        losFrame: controllers.length % AI_LOS_INTERVAL,
    });
}

export function updateAllAI(allPlayers: player_info[], timestamp: number) {
    aiFrameCounter++;
    for (const ai of controllers) {
        if (isPlayerDead(ai.player)) continue;
        updateAI(ai, allPlayers, timestamp);
    }
}

function updateAI(ai: AIController, allPlayers: player_info[], timestamp: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    // Try to buy a better weapon once
    if (!ai.hasBought) {
        tryBuyWeapon(ai);
        tryBuyGrenade(ai);
    }

    // Stuck detection
    const movedDist = getDistance(myCx, myCy, ai.lastPos.x + HALF_HIT_BOX, ai.lastPos.y + HALF_HIT_BOX);
    if (movedDist < STUCK_THRESHOLD) {
        ai.stuckFrames++;
    } else {
        ai.stuckFrames = 0;
    }
    ai.lastPos.x = me.current_position.x;
    ai.lastPos.y = me.current_position.y;

    // If stuck too long, pick a random direction to unstick
    if (ai.stuckFrames >= STUCK_FRAMES_BEFORE_REROUTE && timestamp > ai.unstickUntil) {
        ai.unstickAngle = Math.random() * Math.PI * 2;
        ai.unstickUntil = timestamp + UNSTICK_DURATION;
        ai.stuckFrames = 0;
        // Also regenerate patrol waypoints so we don't path into the same wall
        if (ai.state === 'patrol') {
            ai.waypoints = generatePatrolPoints();
            ai.waypointIndex = 0;
        }
    }

    // If currently unsticking, just walk in the random direction
    if (timestamp < ai.unstickUntil) {
        const dx = Math.cos(ai.unstickAngle);
        const dy = Math.sin(ai.unstickAngle);
        offlineAdapter.sendInput({ type: 'MOVE', playerId: me.id, dx, dy });
        return;
    }

    // Find visible enemies (throttled - expensive LOS check every N frames)
    let closestEnemy: player_info | null = null;
    let closestDist = Infinity;

    const shouldScanLOS = (aiFrameCounter + ai.losFrame) % AI_LOS_INTERVAL === 0;

    if (shouldScanLOS) {
        for (const other of allPlayers) {
            if (other.id === me.id) continue;
            if (other.team === me.team) continue;
            if (isPlayerDead(other)) continue;

            const ox = other.current_position.x + HALF_HIT_BOX;
            const oy = other.current_position.y + HALF_HIT_BOX;
            const dist = getDistance(myCx, myCy, ox, oy);

            if (dist > getConfig().ai.detectRange) continue;

            const blocked = isLineBlocked(me.current_position.x, me.current_position.y, other.current_position.x, other.current_position.y, environment.segments);

            if (!blocked && dist < closestDist) {
                closestEnemy = other;
                closestDist = dist;
            }
        }
        ai.cachedEnemy = closestEnemy;
        ai.cachedEnemyDist = closestDist;
    } else {
        // Use cached result from last LOS scan
        closestEnemy = ai.cachedEnemy;
        closestDist = ai.cachedEnemyDist;
        // Validate cached enemy is still alive
        if (closestEnemy && isPlayerDead(closestEnemy)) {
            closestEnemy = null;
            ai.cachedEnemy = null;
        }
    }

    // State transitions
    if (closestEnemy) {
        ai.state = 'chase';
        ai.targetId = closestEnemy.id;
        ai.targetLastPos = {
            x: closestEnemy.current_position.x,
            y: closestEnemy.current_position.y,
        };
        ai.lastSawTarget = timestamp;
        ai.wallHitShots = 0;
    } else if (ai.state === 'chase') {
        if (timestamp - ai.lastSawTarget > getConfig().ai.chaseTimeout) {
            ai.state = 'patrol';
            ai.targetId = null;
            ai.wallHitShots = 0;
        } else {
            ai.state = 'search';
        }
    } else if (ai.state === 'search') {
        if (timestamp - ai.lastSawTarget > getConfig().ai.chaseTimeout) {
            ai.state = 'patrol';
            ai.targetId = null;
            ai.wallHitShots = 0;
        }
    }

    // Execute behavior
    switch (ai.state) {
        case 'patrol':
            doPatrol(ai, timestamp);
            break;
        case 'chase':
            doChase(ai, closestEnemy!, timestamp);
            break;
        case 'search':
            doSearch(ai, timestamp);
            break;
    }

}

function doPatrol(ai: AIController, timestamp: number) {
    if (timestamp < ai.patrolPauseUntil) {
        ai.stuckFrames = 0;
        return;
    }

    const wp = ai.waypoints[ai.waypointIndex];
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const dist = getDistance(myCx, myCy, wp.x, wp.y);

    if (dist < 30) {
        ai.waypointIndex = (ai.waypointIndex + 1) % ai.waypoints.length;
        ai.patrolPauseUntil = timestamp + getConfig().ai.patrolPause;
        ai.stuckFrames = 0;
        return;
    }

    moveToward(ai, wp.x, wp.y, getConfig().ai.speed * 0.6);
    turnToward(ai, wp.x, wp.y);
}

function doChase(ai: AIController, target: player_info, timestamp: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;
    const tx = target.current_position.x + HALF_HIT_BOX;
    const ty = target.current_position.y + HALF_HIT_BOX;

    const dist = getDistance(myCx, myCy, tx, ty);

    turnToward(ai, tx, ty);

    if (dist > 200) {
        moveToward(ai, tx, ty, getConfig().ai.speed);
    } 
    
    else if (dist < 100) {
        moveToward(ai, tx, ty, -getConfig().ai.speed * 0.5);
    }

    // Check if we actually have line of sight before firing
    const hasLOS = !isLineBlocked(me.current_position.x, me.current_position.y, target.current_position.x, target.current_position.y, environment.segments);

    if (!hasLOS) {
        ai.wallHitShots++;
        // If we've been trying to shoot through walls, stop and move toward target instead
        if (ai.wallHitShots > WALL_CHECK_SHOTS) {
            moveToward(ai, tx, ty, getConfig().ai.speed);
        }
        return;
    }

    ai.wallHitShots = 0;

    // Fire if facing target and have clear LOS
    const angleToTarget = getAngle(myCx, myCy, tx, ty);
    const facingAngle = me.current_position.rotation - ROTATION_OFFSET;
    const diff = normalizeAngle(angleToTarget - facingAngle);

    if (Math.abs(diff) < getConfig().ai.fireCone) {
        tryAIFire(ai, timestamp);
    }

    // Try to throw a grenade if we have one and are close enough
    if (dist < 300) {
        tryAiThrowGrenade(ai, target);
    }
}

function doSearch(ai: AIController, _timestamp: number) {
    if (!ai.targetLastPos) return;

    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const dist = getDistance(myCx, myCy, ai.targetLastPos.x, ai.targetLastPos.y);

    if (dist < 30) {
        me.current_position.rotation += getConfig().ai.turnSpeed * 2;
        return;
    }

    moveToward(ai, ai.targetLastPos.x, ai.targetLastPos.y, getConfig().ai.speed * 0.8);
    turnToward(ai, ai.targetLastPos.x, ai.targetLastPos.y);
}

function moveToward(ai: AIController, tx: number, ty: number, speed: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const angle = Math.atan2(ty - myCy, tx - myCx);
    const direction = speed >= 0 ? 1 : -1;
    const dx = Math.cos(angle) * direction;
    const dy = Math.sin(angle) * direction;

    // Convert desired absolute speed into normalized player MOVE input.
    const playerSpeed = getConfig().player.speed;
    const desiredSpeed = Math.abs(speed);
    const scale = playerSpeed > 0 ? desiredSpeed / playerSpeed : 1;

    offlineAdapter.sendInput({ type: 'MOVE', playerId: me.id, dx: dx * scale, dy: dy * scale });
}

function turnToward(ai: AIController, tx: number, ty: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const targetAngle = getAngle(myCx, myCy, tx, ty) + ROTATION_OFFSET;
    const diff = normalizeAngle(targetAngle - me.current_position.rotation);

    if (Math.abs(diff) < getConfig().ai.turnSpeed) {
        me.current_position.rotation = targetAngle;
    } else {
        me.current_position.rotation += Math.sign(diff) * getConfig().ai.turnSpeed;
    }
}

function tryAIFire(ai: AIController, timestamp: number) {
    const me = ai.player;
    const weapon = getActiveWeapon(me);
    if (!weapon) return;

    if (weapon.ammo <= 0 && !weapon.reloading) {
        offlineAdapter.sendInput({ type: 'RELOAD', playerId: me.id });
        return;
    }

    if (weapon.reloading) {
        const weaponDef = getWeaponDef(weapon.type);
        if (weaponDef.shellReloadTime && weapon.ammo > 0) {
            // Let fire input interrupt shell reload
        } else {
            return;
        }
    }

    // Send fire input - AuthoritativeSimulation handles fire rate, ammo, recoil
    // Sound is played by ClientRenderer.onBulletSpawn
    offlineAdapter.sendInput({ type: 'FIRE', playerId: me.id, timestamp });
}

function tryAiThrowGrenade(ai: AIController, enemy: player_info) {
    const me = ai.player;

    if (Math.random() < 0.5 && me.grenades['FLASH'] > 0) {
        if (isGrenadeAllowed('FLASH')) return;
        offlineAdapter.sendInput({ 
            type: 'THROW_GRENADE', 
            playerId: me.id, 
            grenadeType: 'FLASH', 
            chargePercent: 1.0, 
            aimDx: enemy.current_position.x - me.current_position.x, 
            aimDy: enemy.current_position.y - me.current_position.y 
        });
        return;
    }

    else if (me.grenades['FRAG'] > 0) {
        if (isGrenadeAllowed('FRAG')) return;
        offlineAdapter.sendInput({ 
            type: 'THROW_GRENADE', 
            playerId: me.id, 
            grenadeType: 'FRAG', 
            chargePercent: 1.0, 
            aimDx: enemy.current_position.x - me.current_position.x, 
            aimDy: enemy.current_position.y - me.current_position.y 
        });
        return;
    }


};

function tryBuyGrenade(ai: AIController) {
    const state = offlineAdapter.authSim.getPlayerState(ai.player.id);
    if (!state) return;

    for (const grenadeType of ['FRAG', 'FLASH', 'SMOKE'] as GrenadeType[]) {
        if (!isGrenadeAllowed(grenadeType)) continue;
        const def = getGrenadeDef(grenadeType);
        if (state.money >= def.price) {
            offlineAdapter.sendInput({ type: 'BUY_GRENADE', playerId: ai.player.id, grenadeType });
            return;
        }
    }
}

function tryBuyWeapon(ai: AIController) {
    const state = offlineAdapter.authSim.getPlayerState(ai.player.id);
    if (!state) return;

    for (const weaponType of BUY_PRIORITY) {
        if (!isWeaponAllowed(weaponType)) continue;
        const def = getWeaponDef(weaponType);
        if (state.money >= def.price) {
            offlineAdapter.sendInput({ type: 'BUY_WEAPON', playerId: ai.player.id, weaponType });
            ai.hasBought = true;
            return;
        }
    }
}
