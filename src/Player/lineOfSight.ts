import { getAngle } from '../Utilities/getAngle';
import { getDistance } from '../Utilities/getDistance';
import { app } from '../main';
import { FOV, HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { ACTIVE_PLAYER } from '../Globals/Players';

const lastKnownElements = new Map<string, HTMLElement>();
const lastKnownTimers = new Map<string, ReturnType<typeof setTimeout>>();
const wasVisible = new Map<string, boolean>();
const LAST_KNOWN_FADE_DURATION = 3000;

function normalizeAngle(a: number): number {
    a = a % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}

function isFacingTarget(sourcePlayerInfo: player_info, targetPlayerInfo: player_info): boolean {
    const angleToTarget = getAngle(sourcePlayerInfo.current_position.x, sourcePlayerInfo.current_position.y, targetPlayerInfo.current_position.x, targetPlayerInfo.current_position.y);
    const facingAngle = sourcePlayerInfo.current_position.rotation - ROTATION_OFFSET;
    const diff = normalizeAngle(angleToTarget - facingAngle);
    return diff > -FOV && diff < FOV;
}

export function lineOfSight(blocked: boolean, targetPlayerInfo: player_info, sourcePlayerInfo: player_info, targetPlayerEl?: HTMLElement) {
    const canSee = !blocked && isFacingTarget(sourcePlayerInfo, targetPlayerInfo);
    const key = `${sourcePlayerInfo.id}-${targetPlayerInfo.id}`;
    const prevVisible = wasVisible.get(key) ?? false;
    const sameTeam = sourcePlayerInfo.team === targetPlayerInfo.team;
    const isLocalView = sourcePlayerInfo.id === ACTIVE_PLAYER;

    if (canSee) {
        targetPlayerEl?.classList.add('visible');
        targetPlayerEl?.classList.remove('same-team-not-visible');
        // Remove last known position marker when enemy is in sight
        if (isLocalView) removeLastKnown(key);
    } else {
        targetPlayerEl?.classList.remove('visible');
        if (sameTeam) {
            targetPlayerEl?.classList.add('visible');
            targetPlayerEl?.classList.add('same-team-not-visible');
        } else if (isLocalView && prevVisible && !targetPlayerInfo.dead) {
            // Enemy just went out of sight - place last known position marker
            showLastKnown(key, targetPlayerInfo);
        }
    }

    wasVisible.set(key, canSee);
}

function showLastKnown(key: string, targetPlayerInfo: player_info) {
    // Clear any existing fade timer
    const prevTimer = lastKnownTimers.get(key);
    if (prevTimer) clearTimeout(prevTimer);

    let el = lastKnownElements.get(key);
    if (!el) {
        el = document.createElement('div');
        el.classList.add('last-known-position', `team-${targetPlayerInfo.team}`);
        app.appendChild(el);
        lastKnownElements.set(key, el);
    }
    el.style.opacity = '0.6';
    const x = targetPlayerInfo.current_position.x + HALF_HIT_BOX - 10;
    const y = targetPlayerInfo.current_position.y + HALF_HIT_BOX - 10;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    lastKnownTimers.set(
        key,
        setTimeout(() => {
            if (el) el.style.opacity = '0';
            // Remove from DOM after CSS transition completes
            setTimeout(() => removeLastKnown(key), 500);
        }, LAST_KNOWN_FADE_DURATION),
    );
}

function removeLastKnown(key: string) {
    const el = lastKnownElements.get(key);
    if (el) {
        el.remove();
        lastKnownElements.delete(key);
    }
    const timer = lastKnownTimers.get(key);
    if (timer) {
        clearTimeout(timer);
        lastKnownTimers.delete(key);
    }
}

export function removeLastKnownForPlayer(targetId: number) {
    for (const key of lastKnownElements.keys()) {
        if (key.endsWith(`-${targetId}`)) {
            removeLastKnown(key);
        }
    }
}

export function debugLineOfSight(blocked: boolean, targetPlayerInfo: player_info, sourcePlayerInfo: player_info, targetPlayerEl?: HTMLElement) {
    const facing = isFacingTarget(sourcePlayerInfo, targetPlayerInfo);
    const canSee = !blocked && facing;

    const sx = sourcePlayerInfo.current_position.x + HALF_HIT_BOX;
    const sy = sourcePlayerInfo.current_position.y + HALF_HIT_BOX;
    const tx = targetPlayerInfo.current_position.x + HALF_HIT_BOX;
    const ty = targetPlayerInfo.current_position.y + HALF_HIT_BOX;

    const angleToTarget = getAngle(sx, sy, tx, ty);
    const distance = getDistance(sx, sy, tx, ty);

    const existingLosEl = document.getElementById(`los-${targetPlayerInfo.id}-${sourcePlayerInfo.id}`);
    if (!existingLosEl) {
        const newLosEntity = window.document.createElement('div');
        newLosEntity.id = `los-${targetPlayerInfo.id}-${sourcePlayerInfo.id}`;
        newLosEntity.classList.add(`los`);
        newLosEntity.setAttribute('data-los-id', `${sourcePlayerInfo.id}`);

        if (canSee) {
            targetPlayerEl?.classList.add('visible');
            newLosEntity.style.backgroundColor = 'green';
        } else {
            targetPlayerEl?.classList.remove('visible');
            newLosEntity.style.backgroundColor = 'red';
        }

        newLosEntity.style.width = `${distance}px`;
        newLosEntity.style.transform = `translate3d(${sx}px, ${sy}px, 0) rotate(${angleToTarget}deg)`;

        app.appendChild(newLosEntity);
    } else {
        existingLosEl.style.width = `${distance}px`;

        if (canSee) {
            targetPlayerEl?.classList.add('visible');
            existingLosEl.style.backgroundColor = 'green';
        } else {
            if (sourcePlayerInfo.team === targetPlayerInfo.team) {
                targetPlayerEl?.classList.add('visible');
            } else {
                targetPlayerEl?.classList.remove('visible');
                existingLosEl.style.backgroundColor = 'red';
            }
        }

        existingLosEl.style.transform = `translate3d(${sx}px, ${sy}px, 0) rotate(${angleToTarget}deg)`;
    }
}
