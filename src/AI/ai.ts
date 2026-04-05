import { getAngle } from '../Utilities/getAngle';
import { getDistance } from '../Utilities/getDistance';
import { isLineBlocked } from '../Player/Raycast/raycast';
import { environment } from '../Environment/environment';
import { moveWithCollision } from '../Player/collision';
import { spawnBullet } from '../Combat/projectiles';
import { isPlayerDead } from '../Combat/damage';
import { getActiveWeapon } from '../Combat/shooting';
import { getWeaponDef } from '../Combat/weapons';
import { getPlayerElement, getHealthBarElement } from '../Globals/Players';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { positionHealthBar } from '../Player/player';

const AI_SPEED = 3;
const AI_TURN_SPEED = 4; // degrees per frame
const AI_FIRE_CONE = 8; // must be within this angle to fire
const AI_DETECT_RANGE = 800;
const AI_CHASE_TIMEOUT = 3000; // ms before giving up chase
const AI_PATROL_PAUSE = 1500; // ms to pause at each waypoint

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
    consecutiveShots: number;
    // Stuck detection
    lastPos: coordinates;
    stuckFrames: number;
    unstuckUntil: number;
    unstuckAngle: number;
};

const controllers: AIController[] = [];

// Generate patrol points spread around the map
function generatePatrolPoints(): coordinates[] {
    const points: coordinates[] = [];
    const margin = 300;
    const mapMin = 200;
    const mapMax = 2700;
    for (let i = 0; i < 6; i++) {
        points.push({
            x: mapMin + margin + Math.random() * (mapMax - mapMin - margin * 2),
            y: mapMin + margin + Math.random() * (mapMax - mapMin - margin * 2),
        });
    }
    return points;
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
        consecutiveShots: 0,
        lastPos: { x: player.current_position.x, y: player.current_position.y },
        stuckFrames: 0,
        unstuckUntil: 0,
        unstuckAngle: 0,
    });
}

export function updateAllAI(allPlayers: player_info[], timestamp: number) {
    for (const ai of controllers) {
        if (isPlayerDead(ai.player)) continue;
        updateAI(ai, allPlayers, timestamp);
    }
}

function updateAI(ai: AIController, allPlayers: player_info[], timestamp: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    // Find visible enemies
    let closestEnemy: player_info | null = null;
    let closestDist = Infinity;

    for (const other of allPlayers) {
        if (other.id === me.id) continue;
        if (other.team === me.team) continue;
        if (isPlayerDead(other)) continue;

        const ox = other.current_position.x + HALF_HIT_BOX;
        const oy = other.current_position.y + HALF_HIT_BOX;
        const dist = getDistance(myCx, myCy, ox, oy);

        if (dist > AI_DETECT_RANGE) continue;

        const blocked = isLineBlocked(
            me.current_position.x, me.current_position.y,
            other.current_position.x, other.current_position.y,
            environment.segments
        );

        if (!blocked && dist < closestDist) {
            closestEnemy = other;
            closestDist = dist;
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
    } else if (ai.state === 'chase') {
        if (timestamp - ai.lastSawTarget > AI_CHASE_TIMEOUT) {
            ai.state = 'patrol';
            ai.targetId = null;
            ai.consecutiveShots = 0;
        } else {
            ai.state = 'search';
        }
    } else if (ai.state === 'search') {
        if (timestamp - ai.lastSawTarget > AI_CHASE_TIMEOUT) {
            ai.state = 'patrol';
            ai.targetId = null;
            ai.consecutiveShots = 0;
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

    // Update DOM element
    const el = getPlayerElement(me.id);
    if (el) {
        el.style.transform = `translate3d(${me.current_position.x}px, ${me.current_position.y}px, 0) rotate(${me.current_position.rotation}deg)`;
    }

    // Update health bar position
    const wrap = getHealthBarElement(me.id);
    if (wrap) positionHealthBar(wrap, me);
}

function doPatrol(ai: AIController, timestamp: number) {
    if (timestamp < ai.patrolPauseUntil) return;

    const wp = ai.waypoints[ai.waypointIndex];
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const dist = getDistance(myCx, myCy, wp.x, wp.y);

    if (dist < 30) {
        ai.waypointIndex = (ai.waypointIndex + 1) % ai.waypoints.length;
        ai.patrolPauseUntil = timestamp + AI_PATROL_PAUSE;
        return;
    }

    moveToward(ai, wp.x, wp.y, AI_SPEED * 0.6);
    turnToward(ai, wp.x, wp.y);
}

function doChase(ai: AIController, target: player_info, timestamp: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;
    const tx = target.current_position.x + HALF_HIT_BOX;
    const ty = target.current_position.y + HALF_HIT_BOX;

    const dist = getDistance(myCx, myCy, tx, ty);

    // Turn to face target
    turnToward(ai, tx, ty);

    // Move toward if too far, back off if too close
    if (dist > 200) {
        moveToward(ai, tx, ty, AI_SPEED);
    } else if (dist < 100) {
        moveToward(ai, tx, ty, -AI_SPEED * 0.5);
    }

    // Fire if facing target
    const angleToTarget = getAngle(myCx, myCy, tx, ty);
    const facingAngle = me.current_position.rotation - ROTATION_OFFSET;
    const diff = normalizeAngle(angleToTarget - facingAngle);

    if (Math.abs(diff) < AI_FIRE_CONE) {
        tryAIFire(ai, timestamp);
    } else {
        ai.consecutiveShots = 0;
    }
}

function doSearch(ai: AIController, _timestamp: number) {
    if (!ai.targetLastPos) return;

    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const dist = getDistance(myCx, myCy, ai.targetLastPos.x, ai.targetLastPos.y);

    if (dist < 30) {
        // Reached last known position, look around
        me.current_position.rotation += AI_TURN_SPEED * 2;
        return;
    }

    moveToward(ai, ai.targetLastPos.x, ai.targetLastPos.y, AI_SPEED * 0.8);
    turnToward(ai, ai.targetLastPos.x, ai.targetLastPos.y);
}

function moveToward(ai: AIController, tx: number, ty: number, speed: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const angle = Math.atan2(ty - myCy, tx - myCx);
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;

    const result = moveWithCollision(me.current_position.x, me.current_position.y, dx, dy);
    me.current_position.x = result.x;
    me.current_position.y = result.y;
}

function turnToward(ai: AIController, tx: number, ty: number) {
    const me = ai.player;
    const myCx = me.current_position.x + HALF_HIT_BOX;
    const myCy = me.current_position.y + HALF_HIT_BOX;

    const targetAngle = getAngle(myCx, myCy, tx, ty) + ROTATION_OFFSET;
    const diff = normalizeAngle(targetAngle - me.current_position.rotation);

    if (Math.abs(diff) < AI_TURN_SPEED) {
        me.current_position.rotation = targetAngle;
    } else {
        me.current_position.rotation += Math.sign(diff) * AI_TURN_SPEED;
    }
}

function tryAIFire(ai: AIController, timestamp: number) {
    const me = ai.player;
    const weapon = getActiveWeapon(me);
    if (!weapon) return;

    const weaponDef = getWeaponDef(weapon.type);

    // Reload if empty
    if (weapon.ammo <= 0 && !weapon.reloading) {
        weapon.reloading = true;
        setTimeout(() => {
            weapon.ammo = weapon.maxAmmo;
            weapon.reloading = false;
        }, weaponDef.reloadTime);
        return;
    }

    if (weapon.reloading) return;
    if (timestamp - ai.lastFireTime < weaponDef.fireRate) return;

    ai.lastFireTime = timestamp;
    weapon.ammo--;

    const centerX = me.current_position.x + HALF_HIT_BOX;
    const centerY = me.current_position.y + HALF_HIT_BOX;
    const aimAngle = me.current_position.rotation - ROTATION_OFFSET;

    // AI has some spread/inaccuracy
    const aiSpread = weaponDef.spread + 3;

    for (let p = 0; p < weaponDef.pellets; p++) {
        let bulletAngle = aimAngle + (Math.random() - 0.5) * aiSpread;
        spawnBullet(me.id, centerX, centerY, bulletAngle, weaponDef.bulletSpeed, weaponDef.damage);
    }

    ai.consecutiveShots++;

    if (weapon.ammo <= 0) {
        weapon.reloading = true;
        setTimeout(() => {
            weapon.ammo = weapon.maxAmmo;
            weapon.reloading = false;
        }, weaponDef.reloadTime);
    }
}

function normalizeAngle(a: number): number {
    a = a % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}
