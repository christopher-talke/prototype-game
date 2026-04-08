import { getAngle } from '../Utilities/getAngle';
import { getDistance } from '../Utilities/getDistance';
import { app } from '../Globals/App';
import { FOV, HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { ACTIVE_PLAYER } from '../Globals/Players';
import { cssTransform } from '../Rendering/cssTransform';

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

export type LOSResult = {
    canSee: boolean;
    stateChanged: boolean;
    sameTeam: boolean;
    isLocalView: boolean;
    prevVisible: boolean;
};

// Pure computation: returns visibility state without touching DOM.
export function lineOfSight(blocked: boolean, targetPlayerInfo: player_info, sourcePlayerInfo: player_info): LOSResult {
    const canSee = !blocked && isFacingTarget(sourcePlayerInfo, targetPlayerInfo);
    const key = `${sourcePlayerInfo.id}-${targetPlayerInfo.id}`;
    const prevVisible = wasVisible.get(key) ?? false;
    const stateChanged = canSee !== prevVisible || !wasVisible.has(key);
    const sameTeam = sourcePlayerInfo.team === targetPlayerInfo.team;
    const isLocalView = sourcePlayerInfo.id === ACTIVE_PLAYER;

    wasVisible.set(key, canSee);

    return { canSee, stateChanged, sameTeam, isLocalView, prevVisible };
}

// Rendering: apply visibility CSS classes to player element.
export function applyVisibility(result: LOSResult, targetPlayerEl: HTMLElement) {
    if (!result.stateChanged) return;
    if (result.canSee) {
        targetPlayerEl.classList.add('visible');
        targetPlayerEl.classList.remove('same-team-not-visible');
    } else {
        targetPlayerEl.classList.remove('visible');
        if (result.sameTeam) {
            targetPlayerEl.classList.add('visible');
            targetPlayerEl.classList.add('same-team-not-visible');
        }
    }
}

// Rendering: show/hide last-known position marker.
export function updateLastKnown(result: LOSResult, targetPlayerInfo: player_info, sourcePlayerInfo: player_info) {
    const key = `${sourcePlayerInfo.id}-${targetPlayerInfo.id}`;
    if (result.canSee) {
        if (result.isLocalView) removeLastKnown(key);
    } else if (result.isLocalView && result.prevVisible && !targetPlayerInfo.dead && !result.sameTeam) {
        showLastKnown(key, targetPlayerInfo);
    }
}

function showLastKnown(key: string, targetPlayerInfo: player_info) {
    const prevTimer = lastKnownTimers.get(key);
    if (prevTimer) clearTimeout(prevTimer);

    let el = lastKnownElements.get(key);
    if (!el) {
        el = document.createElement('div');
        el.classList.add('last-known-position');
        el.setAttribute('data-team', `${targetPlayerInfo.team}`);
        app.appendChild(el);
        lastKnownElements.set(key, el);
    }
    el.setAttribute('data-team', `${targetPlayerInfo.team}`);
    el.style.opacity = '0.6';
    const x = targetPlayerInfo.current_position.x + HALF_HIT_BOX - 10;
    const y = targetPlayerInfo.current_position.y + HALF_HIT_BOX - 10;
    el.style.transform = cssTransform(x, y);

    lastKnownTimers.set(
        key,
        setTimeout(() => {
            if (el) el.style.opacity = '0';
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
        newLosEntity.style.transform = cssTransform(sx, sy, angleToTarget);

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

        existingLosEl.style.transform = cssTransform(sx, sy, angleToTarget);
    }
}
