/**
 * Renderer-agnostic computation for the diegetic HUD.
 *
 * Owns all mutable state (spring positions, fade timers, reload tracking).
 * Each frame the render pipeline calls `tickDiegeticHud()` with fresh input
 * and receives a pure output struct consumed by whichever renderer is active.
 * No rendering imports - this module is pure math + timers.
 *
 * Part of the rendering layer. Consumed by `pixiDiegeticHud.ts` (and future
 * DOM renderer). Fed by `renderPipeline.ts`.
 */

import { diegeticHudConfig as C } from './diegeticHudConfig';

export interface DiegeticHudInput {
    playerX: number;
    playerY: number;
    facingRad: number;
    health: number;
    armour: number;
    ammo: number;
    maxAmmo: number;
    isReloading: boolean;
    weaponType: string;
    money: number;
    grenades: Record<string, number>;
    selectedGrenadeType: string;
    viewportW: number;
    viewportH: number;
    cameraX: number;
    cameraY: number;
    timestamp: number;
    isDead: boolean;
    isBuying: boolean;
    isZoomed: boolean;
}

export interface ArcOutput {
    cx: number;
    cy: number;
    radius: number;
    startAngle: number;
    endAngle: number;
    hpEndAngle: number;
    hpColor: number;
    hpAlpha: number;
    tipX: number;
    tipY: number;
    tipAlpha: number;
    armorRadius: number;
    armorEndAngle: number;
    armorAlpha: number;
}

export interface BoxOutput {
    worldX: number;
    worldY: number;
    anchorX: number;
    anchorY: number;
    alpha: number;
    visible: boolean;
    label: string;
    value: string;
    valueColor: number;
}

export interface AmmoBoxOutput extends BoxOutput {
    showReloadBar: boolean;
    reloadFraction: number;
    emptyPulse: boolean;
    emptyPulsePhase: number;
}

export interface GrenadeBoxOutput extends BoxOutput {
    pips: { type: string; active: boolean }[];
}

export interface DiegeticHudOutput {
    visible: boolean;
    arc: ArcOutput;
    ammoBox: AmmoBoxOutput;
    moneyBox: BoxOutput;
    grenadeBox: GrenadeBoxOutput;
}

interface BoxSpring {
    x: number;
    y: number;
    init: boolean;
    lastActivity: number;
}

const _springs: Record<string, BoxSpring> = {
    ammo:    { x: 0, y: 0, init: false, lastActivity: 0 },
    money:   { x: 0, y: 0, init: false, lastActivity: 0 },
    grenade: { x: 0, y: 0, init: false, lastActivity: 0 },
};

let _lastAmmo = -1;
let _lastMaxAmmo = -1;
let _lastWeaponType = '';
let _lastMoney = -1;
let _lastGrenadeType = '';
let _lastGrenadeCounts = '';
let _reloadStartTime = 0;
let _reloadDuration = 0;
let _moneyForceShow = false;
let _grenadeForceShow = false;

/**
 * Clear all spring positions, fade timers, and cached values.
 * Called on round start and player respawn.
 */
export function resetDiegeticHud() {
    for (const key of Object.keys(_springs)) {
        _springs[key].x = 0;
        _springs[key].y = 0;
        _springs[key].init = false;
        _springs[key].lastActivity = 0;
    }
    _lastAmmo = -1;
    _lastMaxAmmo = -1;
    _lastWeaponType = '';
    _lastMoney = -1;
    _lastGrenadeType = '';
    _lastGrenadeCounts = '';
    _reloadStartTime = 0;
    _reloadDuration = 0;
    _moneyForceShow = false;
    _grenadeForceShow = false;
}

/**
 * Begin tracking a reload for the progress bar.
 * @param reloadDuration - Total reload time in milliseconds.
 * @param timestamp - Frame timestamp when the reload started.
 */
export function setReloadStart(reloadDuration: number, timestamp: number) {
    _reloadStartTime = timestamp;
    _reloadDuration = reloadDuration;
}

/** Clear reload tracking (called on RELOAD_COMPLETE). */
export function clearReload() {
    _reloadStartTime = 0;
    _reloadDuration = 0;
}

/** Force the money box visible on next tick (e.g. entering buy zone). */
export function showMoneyBox() {
    _moneyForceShow = true;
}

/** Force the grenade box visible on next tick (e.g. throwing a grenade). */
export function showGrenadeBox() {
    _grenadeForceShow = true;
}

/**
 * Advance the diegetic HUD one frame: compute arc geometry, spring-interpolate
 * box positions, resolve collisions, and return the full output for rendering.
 * @param input - Fresh per-frame state from the render pipeline.
 * @returns Output struct consumed by the active renderer.
 */
export function tickDiegeticHud(input: DiegeticHudInput): DiegeticHudOutput {
    const { playerX, playerY, facingRad, timestamp } = input;
    const opp = facingRad + Math.PI;

    const arc = computeArc(playerX, playerY, opp, input.health, input.armour);

    detectAmmoChanges(input, timestamp);
    detectMoneyChanges(input, timestamp);
    detectGrenadeChanges(input, timestamp);

    let reloadFraction = 0;
    if (input.isReloading && _reloadStartTime > 0 && _reloadDuration > 0) {
        reloadFraction = Math.min(1, (timestamp - _reloadStartTime) / _reloadDuration);
    }

    const ammoBox = buildAmmoBox(input, timestamp, reloadFraction);
    const moneyBox = buildMoneyBox(input, timestamp);
    const grenadeBox = buildGrenadeBox(input, timestamp);

    const activeBoxes: { key: string; box: BoxOutput }[] = [];
    if (ammoBox.visible) activeBoxes.push({ key: 'ammo', box: ammoBox });
    if (moneyBox.visible) activeBoxes.push({ key: 'money', box: moneyBox });
    if (grenadeBox.visible) activeBoxes.push({ key: 'grenade', box: grenadeBox });

    const targets = computeBoxTargets(
        playerX, playerY, opp, C.arcRadius,
        activeBoxes.length,
        input.viewportW, input.viewportH,
        input.cameraX, input.cameraY,
    );

    for (let i = 0; i < activeBoxes.length; i++) {
        const { key, box } = activeBoxes[i];
        const tgt = targets[i];
        const spr = _springs[key];

        if (!spr.init) {
            spr.x = tgt.bx;
            spr.y = tgt.by;
            spr.init = true;
        }

        spr.x += (tgt.bx - spr.x) * C.spring;
        spr.y += (tgt.by - spr.y) * C.spring;

        enforceExclusion(spr, playerX, playerY);

        box.worldX = spr.x;
        box.worldY = spr.y;
        box.anchorX = tgt.ax;
        box.anchorY = tgt.ay;
    }

    if (!ammoBox.visible) _springs.ammo.init = false;
    if (!moneyBox.visible) _springs.money.init = false;
    if (!grenadeBox.visible) _springs.grenade.init = false;

    return {
        visible: !input.isDead,
        arc,
        ammoBox,
        moneyBox,
        grenadeBox,
    };
}

function computeArc(
    cx: number, cy: number, opp: number,
    health: number, armour: number,
): ArcOutput {
    const halfSpan = C.arcSpan / 2;
    const startAngle = opp - halfSpan;
    const endAngle = opp + halfSpan;

    const hpFrac = Math.max(0, Math.min(1, health / 100));
    const hpEndAngle = startAngle + C.arcSpan * hpFrac;

    let hpColor: number;
    let hpAlpha: number;
    let tipAlpha: number;

    if (health > C.hpHighThreshold) {
        hpColor = C.hpColorHigh;
        hpAlpha = C.hpAlphaHigh;
        tipAlpha = C.tipAlphaHigh;
    }

    else if (health > C.hpMidThreshold) {
        hpColor = C.hpColorMid;
        hpAlpha = C.hpAlphaMid;
        tipAlpha = C.tipAlphaMid;
    }

    else {
        hpColor = C.hpColorLow;
        hpAlpha = C.hpAlphaLow;
        tipAlpha = C.tipAlphaLow;
    }

    const tipX = cx + C.arcRadius * Math.cos(hpEndAngle);
    const tipY = cy + C.arcRadius * Math.sin(hpEndAngle);

    const armorFrac = Math.max(0, Math.min(1, armour / 100));
    const armorEndAngle = startAngle + C.arcSpan * armorFrac;

    return {
        cx, cy,
        radius: C.arcRadius,
        startAngle, endAngle,
        hpEndAngle, hpColor, hpAlpha,
        tipX, tipY, tipAlpha,
        armorRadius: C.armorArcRadius,
        armorEndAngle,
        armorAlpha: C.armorAlpha,
    };
}

function detectAmmoChanges(input: DiegeticHudInput, timestamp: number) {
    const changed =
        input.ammo !== _lastAmmo ||
        input.maxAmmo !== _lastMaxAmmo ||
        input.weaponType !== _lastWeaponType ||
        input.isReloading;

    if (changed) {
        _springs.ammo.lastActivity = timestamp;
        _lastAmmo = input.ammo;
        _lastMaxAmmo = input.maxAmmo;
        _lastWeaponType = input.weaponType;
    }
}

function detectMoneyChanges(input: DiegeticHudInput, timestamp: number) {
    if (input.money !== _lastMoney) {
        _springs.money.lastActivity = timestamp;
        _lastMoney = input.money;
    }

    if (_moneyForceShow) {
        _springs.money.lastActivity = timestamp;
        _moneyForceShow = false;
    }
}

function detectGrenadeChanges(input: DiegeticHudInput, timestamp: number) {
    const countsKey = JSON.stringify(input.grenades);

    if (input.selectedGrenadeType !== _lastGrenadeType || countsKey !== _lastGrenadeCounts) {
        _springs.grenade.lastActivity = timestamp;
        _lastGrenadeType = input.selectedGrenadeType;
        _lastGrenadeCounts = countsKey;
    }

    if (_grenadeForceShow) {
        _springs.grenade.lastActivity = timestamp;
        _grenadeForceShow = false;
    }
}

/**
 * Push a spring position outward so no part of the box overlaps the arc ring.
 * Acts as a hard constraint after spring interpolation.
 */
function enforceExclusion(spr: BoxSpring, pcx: number, pcy: number) {
    const halfDiag = Math.sqrt((C.boxW / 2) ** 2 + (C.boxH / 2) ** 2);
    const minDist = C.arcRadius + halfDiag + C.playerPushPad;

    const dx = spr.x - pcx;
    const dy = spr.y - pcy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist && dist > 0) {
        spr.x = pcx + (dx / dist) * minDist;
        spr.y = pcy + (dy / dist) * minDist;
    }
}

function computeFadeAlpha(lastActivity: number, timestamp: number, showMs: number, fadeMs: number): number {
    if (lastActivity <= 0) return 0;
    const elapsed = timestamp - lastActivity;

    if (elapsed < showMs) return 1;

    const fadeElapsed = elapsed - showMs;
    if (fadeElapsed >= fadeMs) return 0;

    return 1 - fadeElapsed / fadeMs;
}

function buildAmmoBox(input: DiegeticHudInput, timestamp: number, reloadFraction: number): AmmoBoxOutput {
    const forceVisible = input.isZoomed || input.isReloading || (input.ammo === 0 && input.maxAmmo > 0);
    const alpha = forceVisible
        ? 1
        : computeFadeAlpha(_springs.ammo.lastActivity, timestamp, C.ammoShowMs, C.ammoFadeMs);

    const value = input.isReloading ? 'RLD' : `${input.ammo}/${input.maxAmmo}`;

    let valueColor: number;
    if (input.isReloading) {
        valueColor = C.ammoNormalColor;
    }

    else if (input.ammo <= C.ammoLowThreshold) {
        valueColor = C.ammoLowColor;
    }

    else if (input.ammo <= C.ammoMidThreshold) {
        valueColor = C.ammoMidColor;
    }

    else {
        valueColor = C.ammoNormalColor;
    }

    const emptyPulse = input.ammo === 0 && input.maxAmmo > 0 && !input.isReloading;

    return {
        worldX: 0, worldY: 0,
        anchorX: 0, anchorY: 0,
        alpha,
        visible: alpha > 0,
        label: 'AMMO',
        value,
        valueColor,
        showReloadBar: input.isReloading,
        reloadFraction,
        emptyPulse,
        emptyPulsePhase: emptyPulse ? Math.sin(timestamp * C.emptyPulseSpeed) : 0,
    };
}

function buildMoneyBox(input: DiegeticHudInput, timestamp: number): BoxOutput {
    const forceVisible = input.isZoomed || input.isBuying;
    const alpha = forceVisible
        ? 1
        : computeFadeAlpha(_springs.money.lastActivity, timestamp, C.subShowMs, C.subFadeMs);

    return {
        worldX: 0, worldY: 0,
        anchorX: 0, anchorY: 0,
        alpha,
        visible: alpha > 0,
        label: 'CASH',
        value: `$${input.money.toLocaleString()}`,
        valueColor: C.ammoNormalColor,
    };
}

function buildGrenadeBox(input: DiegeticHudInput, timestamp: number): GrenadeBoxOutput {
    const alpha = input.isZoomed
        ? 1
        : computeFadeAlpha(_springs.grenade.lastActivity, timestamp, C.subShowMs, C.subFadeMs);

    const count = input.grenades[input.selectedGrenadeType] ?? 0;
    const pips = Object.keys(input.grenades).map(type => ({
        type,
        active: type === input.selectedGrenadeType,
    }));

    return {
        worldX: 0, worldY: 0,
        anchorX: 0, anchorY: 0,
        alpha,
        visible: alpha > 0,
        label: input.selectedGrenadeType,
        value: `x${count}`,
        valueColor: C.ammoNormalColor,
        pips,
    };
}

interface BoxTarget {
    bx: number;
    by: number;
    ax: number;
    ay: number;
}

/**
 * Compute target positions for all active info boxes. Distributes boxes
 * angularly around the arc's opposite side, pushes outward, resolves
 * box-box and box-player overlaps, and clamps to the viewport.
 */
function computeBoxTargets(
    pcx: number, pcy: number,
    opp: number, arcR: number,
    count: number,
    vpW: number, vpH: number,
    camX: number, camY: number,
): BoxTarget[] {
    if (count === 0) return [];

    const outerR = arcR + C.boxTether;
    const minSep = C.boxH + C.boxMargin;
    const angStep = Math.max(0.25, Math.asin(Math.min(0.95, minSep / outerR)));

    const results: BoxTarget[] = [];

    for (let i = 0; i < count; i++) {
        const offset = i - (count - 1) / 2;
        const anchorAngle = opp + offset * angStep;

        const ax = pcx + arcR * Math.cos(anchorAngle);
        const ay = pcy + arcR * Math.sin(anchorAngle);

        const dx = ax - pcx;
        const dy = ay - pcy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        let bx = ax + nx * C.boxTether;
        let by = ay + ny * C.boxTether;

        bx = clampToViewport(bx, C.boxW, vpW, camX);
        by = clampToViewport(by, C.boxH, vpH, camY);

        pushFromPlayer(pcx, pcy, bx, by, vpW, vpH, camX, camY, (nx2, ny2) => {
            bx = nx2;
            by = ny2;
        });

        for (let pass = 0; pass < 3; pass++) {
            for (let j = 0; j < results.length; j++) {
                const o = results[j];
                if (boxesOverlap(bx, by, o.bx, o.by)) {
                    const sdx = bx - o.bx;
                    const sdy = by - o.by;
                    const sDist = Math.sqrt(sdx * sdx + sdy * sdy) || 0.1;
                    const needDist = C.boxH + C.boxMargin * 2;
                    bx = o.bx + (sdx / sDist) * needDist;
                    by = o.by + (sdy / sDist) * needDist;
                    bx = clampToViewport(bx, C.boxW, vpW, camX);
                    by = clampToViewport(by, C.boxH, vpH, camY);
                }
            }
        }

        pushFromPlayer(pcx, pcy, bx, by, vpW, vpH, camX, camY, (nx2, ny2) => {
            bx = nx2;
            by = ny2;
        });

        results.push({ bx, by, ax, ay });
    }

    return results;
}

function clampToViewport(pos: number, size: number, vpSize: number, camOffset: number): number {
    const half = size / 2 + C.edgePad;
    const minWorld = camOffset + half;
    const maxWorld = camOffset + vpSize - half;
    return Math.max(minWorld, Math.min(maxWorld, pos));
}

function pushFromPlayer(
    pcx: number, pcy: number,
    bx: number, by: number,
    vpW: number, vpH: number,
    camX: number, camY: number,
    apply: (nx: number, ny: number) => void,
) {
    const pdx = bx - pcx;
    const pdy = by - pcy;
    const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
    const minPC = C.arcRadius + C.boxW / 2 + C.playerPushPad;

    if (pDist < minPC && pDist > 0) {
        let nx = pcx + (pdx / pDist) * minPC;
        let ny = pcy + (pdy / pDist) * minPC;
        nx = clampToViewport(nx, C.boxW, vpW, camX);
        ny = clampToViewport(ny, C.boxH, vpH, camY);
        apply(nx, ny);
    }

    else {
        apply(bx, by);
    }
}

function boxesOverlap(ax: number, ay: number, bx: number, by: number): boolean {
    const hw = C.boxW / 2 + C.boxMargin;
    const hh = C.boxH / 2 + C.boxMargin;
    return !(ax + hw < bx - hw || bx + hw < ax - hw || ay + hh < by - hh || by + hh < ay - hh);
}
