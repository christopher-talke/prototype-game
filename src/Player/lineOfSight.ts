import { getAngle } from '../Utilities/getAngle';
import { getDistance } from '../Utilities/getDistance';
import { app } from '../main';
import { FOV, HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';

function normalizeAngle(a: number): number {
    a = a % 360;
    if (a > 180) a -= 360;
    if (a <= -180) a += 360;
    return a;
}

function isFacingTarget(sourcePlayerInfo: player_info, targetPlayerInfo: player_info): boolean {
    const angleToTarget = getAngle(
        sourcePlayerInfo.current_position.x, sourcePlayerInfo.current_position.y,
        targetPlayerInfo.current_position.x, targetPlayerInfo.current_position.y
    );
    const facingAngle = sourcePlayerInfo.current_position.rotation - ROTATION_OFFSET;
    const diff = normalizeAngle(angleToTarget - facingAngle);
    return diff > -FOV && diff < FOV;
}

export function lineOfSight(blocked: boolean, targetPlayerInfo: player_info, sourcePlayerInfo: player_info, targetPlayerEl?: HTMLElement) {
    const canSee = !blocked && isFacingTarget(sourcePlayerInfo, targetPlayerInfo);

    if (canSee) {
        targetPlayerEl?.classList.add('visible');
        targetPlayerEl?.classList.remove('same-team-not-visible');
    } else {
        targetPlayerEl?.classList.remove('visible');
    }

    // Always keep teammates visible (but dimmed) even if not facing them
    if (!canSee && sourcePlayerInfo.team === targetPlayerInfo.team) {
        targetPlayerEl?.classList.add('visible');
        targetPlayerEl?.classList.add('same-team-not-visible');
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
