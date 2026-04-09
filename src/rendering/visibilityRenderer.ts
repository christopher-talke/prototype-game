import { app } from '../app';
import { HALF_HIT_BOX } from '../constants';
import { getAngle } from '@utils/getAngle';
import { getDistance } from '@utils/getDistance';
import { cssTransform } from '@rendering/cssTransform';
import { isFacingTarget, type LOSResult } from '@simulation/player/visibility';

const lastKnownElements = new Map<string, HTMLElement>();
const lastKnownTimers = new Map<string, ReturnType<typeof setTimeout>>();
const LAST_KNOWN_FADE_DURATION = 3000;

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

export function updateLastKnown(result: LOSResult, targetPlayerInfo: player_info, sourcePlayerInfo: player_info) {
    const key = `${sourcePlayerInfo.id}-${targetPlayerInfo.id}`;
    if (result.canSee) {
        if (result.isLocalView) removeLastKnown(key);
    } else if (result.isLocalView && result.prevVisible && !targetPlayerInfo.dead && !result.sameTeam) {
        showLastKnown(key, targetPlayerInfo);
    }
}

function showLastKnown(key: string, targetPlayerInfo: player_info) {
    if (app === undefined) return;

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
    if (app === undefined) return;

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
