import { getAngle } from '../Utilities/getAngle';
import { getDistance } from '../Utilities/getDistance';
import { isLineBlocked } from '../Player/Raycast/raycast';
import { environment } from '../Environment/environment';
import { moveWithCollision } from '../Player/collision';
import { spawnBullet } from '../Combat/projectiles';
import { isPlayerDead } from '../Combat/damage';
import { getActiveWeapon } from '../Combat/shooting';
import { getWeaponDef, isWeaponAllowed } from '../Combat/weapons';
import { getPlayerElement, getHealthBarElement } from '../Globals/Players';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { positionHealthBar } from '../Player/player';
import { buyWeapon, getPlayerState } from '../Combat/gameState';
import { playSoundAtPlayer, playFootstep } from '../Audio/audio';
import { getWeaponSoundId, getWeaponReloadSoundId } from '../Audio/soundMap';
import { getConfig } from '../Config/activeConfig';

const STUCK_THRESHOLD = 2;
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
};

const controllers: AIController[] = [];

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
        lastPos: { x: player.current_position.x, y: player.current_position.y },
        stuckFrames: 0,
        unstickUntil: 0,
        unstickAngle: 0,
        wallHitShots: 0,
        hasBought: false,
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

    // Try to buy a better weapon once
    if (!ai.hasBought) {
        tryBuyWeapon(ai);
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
        const aiSpeed = getConfig().ai.speed;
        const dx = Math.cos(ai.unstickAngle) * aiSpeed;
        const dy = Math.sin(ai.unstickAngle) * aiSpeed;
        const result = moveWithCollision(me.current_position.x, me.current_position.y, dx, dy);
        me.current_position.x = result.x;
        me.current_position.y = result.y;
        updateElement(ai);
        return;
    }

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

        if (dist > getConfig().ai.detectRange) continue;

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

    updateElement(ai);
}

function updateElement(ai: AIController) {
    const me = ai.player;
    const el = getPlayerElement(me.id);
    if (el) {
        el.style.transform = `translate3d(${me.current_position.x}px, ${me.current_position.y}px, 0) rotate(${me.current_position.rotation}deg)`;
    }
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
        ai.patrolPauseUntil = timestamp + getConfig().ai.patrolPause;
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
    } else if (dist < 100) {
        moveToward(ai, tx, ty, -getConfig().ai.speed * 0.5);
    }

    // Check if we actually have line of sight before firing
    const hasLOS = !isLineBlocked(
        me.current_position.x, me.current_position.y,
        target.current_position.x, target.current_position.y,
        environment.segments
    );

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
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;

    const prevX = me.current_position.x;
    const prevY = me.current_position.y;
    const result = moveWithCollision(me.current_position.x, me.current_position.y, dx, dy);
    me.current_position.x = result.x;
    me.current_position.y = result.y;

    // Play footstep if actually moved
    if (result.x !== prevX || result.y !== prevY) {
        playFootstep(me, performance.now());
    }
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

    const weaponDef = getWeaponDef(weapon.type);

    if (weapon.ammo <= 0 && !weapon.reloading) {
        weapon.reloading = true;
        startAIReload(weapon, weaponDef, me);
        return;
    }

    if (weapon.reloading) {
        // AI with shell-reload weapons can interrupt reload to fire
        if (weaponDef.shellReloadTime && weapon.ammo > 0) {
            weapon.reloading = false;
        } else {
            return;
        }
    }
    if (timestamp - ai.lastFireTime < weaponDef.fireRate) return;

    ai.lastFireTime = timestamp;
    weapon.ammo--;

    playSoundAtPlayer(getWeaponSoundId(weapon.type), me);

    const centerX = me.current_position.x + HALF_HIT_BOX;
    const centerY = me.current_position.y + HALF_HIT_BOX;
    const aimAngle = me.current_position.rotation - ROTATION_OFFSET;

    const aiSpread = weaponDef.spread + 3;

    for (let p = 0; p < weaponDef.pellets; p++) {
        const bulletAngle = aimAngle + (Math.random() - 0.5) * aiSpread;
        spawnBullet(me.id, centerX, centerY, bulletAngle, weaponDef.bulletSpeed, weaponDef.damage, weaponDef.id);
    }

    if (weapon.ammo <= 0) {
        weapon.reloading = true;
        startAIReload(weapon, weaponDef, me);
    }

    // Mechanical sound (shotgun pump, sniper bolt, etc.)
    if (weaponDef.mechanicalSound && weaponDef.mechanicalDelay && weapon.ammo > 0) {
        const soundId = weaponDef.mechanicalSound;
        const player = me;
        setTimeout(() => {
            playSoundAtPlayer(soundId, player);
        }, weaponDef.mechanicalDelay);
    }
}

function startAIReload(weapon: PlayerWeapon, weaponDef: WeaponDef, player: player_info) {
    if (weaponDef.shellReloadTime) {
        // Shell-by-shell reload
        loadAIShell(weapon, weaponDef, player);
    } else {
        playSoundAtPlayer(getWeaponReloadSoundId(weapon.type), player);
        setTimeout(() => {
            weapon.ammo = weapon.maxAmmo;
            weapon.reloading = false;
        }, weaponDef.reloadTime);
    }
}

function loadAIShell(weapon: PlayerWeapon, weaponDef: WeaponDef, player: player_info) {
    playSoundAtPlayer('shotgun_shell', player);

    setTimeout(() => {
        if (!weapon.reloading) return; // cancelled by firing
        weapon.ammo++;
        if (weapon.ammo < weapon.maxAmmo) {
            loadAIShell(weapon, weaponDef, player);
        } else {
            weapon.reloading = false;
        }
    }, weaponDef.shellReloadTime!);
}

function tryBuyWeapon(ai: AIController) {
    const state = getPlayerState(ai.player.id);
    if (!state) return;

    for (const weaponType of BUY_PRIORITY) {
        if (!isWeaponAllowed(weaponType)) continue;
        const def = getWeaponDef(weaponType);
        if (state.money >= def.price) {
            if (buyWeapon(ai.player.id, weaponType, ai.player)) {
                ai.hasBought = true;
                return;
            }
        }
    }
}

function normalizeAngle(a: number): number {
    a = a % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}
