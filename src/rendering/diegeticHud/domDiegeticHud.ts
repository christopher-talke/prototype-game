/**
 * DOM rendering layer for the diegetic HUD.
 *
 * Creates a fixed SVG overlay for arcs, tethers, and dots, plus positioned
 * div elements for tethered info boxes. Each frame `updateDomDiegeticHud()`
 * converts world-space output from the state module to screen coordinates
 * via `worldToScreen()` and updates all elements.
 *
 * Part of the DOM rendering layer. Consumed by `renderPipeline.ts`.
 */

import { diegeticHudConfig as C } from './diegeticHudConfig';
import type { DiegeticHudOutput, BoxOutput, AmmoBoxOutput, GrenadeBoxOutput } from './diegeticHudState';
import { worldToScreen } from '@rendering/dom/camera';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FONT_FAMILY = "'Share Tech Mono', 'Courier New', monospace";

let _svgRoot: SVGSVGElement | null = null;
let _boxContainer: HTMLDivElement | null = null;

let _ghostRing: SVGCircleElement;
let _hpBg: SVGPathElement;
let _hpFill: SVGPathElement;
let _hpTip: SVGCircleElement;
let _armorBg: SVGPathElement;
let _armorFill: SVGPathElement;
let _armorTip: SVGCircleElement;

interface TetherEls {
    line: SVGLineElement;
    dot: SVGCircleElement;
}

let _tethers: TetherEls[];

interface BoxEls {
    root: HTMLDivElement;
    label: HTMLSpanElement;
    value: HTMLSpanElement;
}

interface AmmoBoxEls extends BoxEls {
    reloadBar: HTMLDivElement;
    reloadFill: HTMLDivElement;
    reloadSweep: HTMLDivElement;
}

interface GrenadeBoxEls extends BoxEls {
    pipsContainer: HTMLDivElement;
}

let _ammo: AmmoBoxEls;
let _money: BoxEls;
let _grenade: GrenadeBoxEls;

let _lastAmmoLabel = '';
let _lastAmmoValue = '';
let _lastMoneyValue = '';
let _lastGrenadeLabel = '';
let _lastGrenadeValue = '';
let _lastPipCount = -1;

function hexToRgba(hex: number, alpha: number): string {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string>): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
        for (const k in attrs) el.setAttribute(k, attrs[k]);
    }
    return el;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const sweep = endAngle - startAngle;
    if (Math.abs(sweep) < 0.001) return '';
    const sx = cx + r * Math.cos(startAngle);
    const sy = cy + r * Math.sin(startAngle);
    const ex = cx + r * Math.cos(endAngle);
    const ey = cy + r * Math.sin(endAngle);
    const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
    const sweepFlag = sweep > 0 ? 1 : 0;
    return `M${sx.toFixed(1)},${sy.toFixed(1)} A${r},${r} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

function createBoxEls(): BoxEls {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.left = '0';
    root.style.top = '0';
    root.style.boxSizing = 'border-box';
    root.style.width = C.boxW + 'px';
    root.style.height = C.boxH + 'px';
    root.style.borderRadius = '1px';
    root.style.background = hexToRgba(C.boxBgColor, C.boxBgAlpha);
    root.style.border = `${C.boxStrokeWidth}px solid ${hexToRgba(C.boxStrokeColor, C.boxStrokeAlpha)}`;
    root.style.pointerEvents = 'none';
    root.style.display = 'flex';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'space-between';
    root.style.padding = `0 ${C.boxPad}px`;
    root.style.willChange = 'transform, opacity';
    root.style.fontFamily = FONT_FAMILY;

    const label = document.createElement('span');
    label.style.fontSize = C.boxLabelFontSize + 'px';
    label.style.color = hexToRgba(C.boxStrokeColor, C.boxLabelAlpha);
    label.style.letterSpacing = '0.07em';
    root.appendChild(label);

    const value = document.createElement('span');
    value.style.fontSize = C.boxValueFontSize + 'px';
    value.style.letterSpacing = '0.07em';
    root.appendChild(value);

    return { root, label, value };
}

function resetDirtyCache() {
    _lastAmmoLabel = '';
    _lastAmmoValue = '';
    _lastMoneyValue = '';
    _lastGrenadeLabel = '';
    _lastGrenadeValue = '';
    _lastPipCount = -1;
}

/**
 * Create all DOM elements for the diegetic HUD and append to `document.body`.
 * Idempotent -- returns immediately if already initialized.
 */
export function initDomDiegeticHud() {
    if (_svgRoot) return;

    document.body.classList.add('renderer-dom');

    _svgRoot = svgEl('svg');
    _svgRoot.id = 'diegetic-hud-svg';
    _svgRoot.style.position = 'fixed';
    _svgRoot.style.inset = '0';
    _svgRoot.style.width = '100vw';
    _svgRoot.style.height = '100vh';
    _svgRoot.style.pointerEvents = 'none';
    _svgRoot.style.zIndex = '50';
    _svgRoot.setAttribute('xmlns', SVG_NS);

    _ghostRing = svgEl('circle');
    _ghostRing.setAttribute('fill', 'none');
    _ghostRing.setAttribute('stroke', hexToRgba(C.hpColorHigh, C.ghostRingAlpha));
    _ghostRing.setAttribute('stroke-width', '0.5');
    _svgRoot.appendChild(_ghostRing);

    _armorBg = svgEl('path', { fill: 'none', stroke: hexToRgba(C.armorColor, 0.06), 'stroke-width': String(C.armorStrokeWidth), 'stroke-linecap': 'round' });
    _svgRoot.appendChild(_armorBg);
    _armorFill = svgEl('path', { fill: 'none', 'stroke-width': String(C.armorStrokeWidth), 'stroke-linecap': 'round' });
    _svgRoot.appendChild(_armorFill);
    _armorTip = svgEl('circle', { r: String(C.tipDotRadius * 0.7) });
    _svgRoot.appendChild(_armorTip);

    _hpBg = svgEl('path', { fill: 'none', stroke: hexToRgba(C.hpColorHigh, 0.08), 'stroke-width': String(C.arcStrokeWidth), 'stroke-linecap': 'round' });
    _svgRoot.appendChild(_hpBg);
    _hpFill = svgEl('path', { fill: 'none', 'stroke-width': String(C.arcStrokeWidth), 'stroke-linecap': 'round' });
    _svgRoot.appendChild(_hpFill);
    _hpTip = svgEl('circle', { r: String(C.tipDotRadius) });
    _svgRoot.appendChild(_hpTip);

    _tethers = [];
    for (let i = 0; i < 3; i++) {
        const line = svgEl('line', {
            stroke: hexToRgba(C.hpColorHigh, C.tetherAlpha),
            'stroke-width': String(C.tetherWidth),
            'stroke-dasharray': `${C.tetherDash} ${C.tetherGap}`,
        });
        const dot = svgEl('circle', {
            r: String(C.tetherAnchorRadius),
            fill: hexToRgba(C.hpColorHigh, C.tetherAnchorAlpha),
        });
        line.style.display = 'none';
        dot.style.display = 'none';
        _svgRoot.appendChild(line);
        _svgRoot.appendChild(dot);
        _tethers.push({ line, dot });
    }

    document.body.appendChild(_svgRoot);

    _boxContainer = document.createElement('div');
    _boxContainer.id = 'diegetic-hud-boxes';
    _boxContainer.style.position = 'fixed';
    _boxContainer.style.inset = '0';
    _boxContainer.style.pointerEvents = 'none';
    _boxContainer.style.zIndex = '51';

    const ammoBase = createBoxEls();
    const reloadBar = document.createElement('div');
    reloadBar.style.position = 'absolute';
    reloadBar.style.left = '0';
    reloadBar.style.bottom = '0';
    reloadBar.style.width = '100%';
    reloadBar.style.height = '1px';
    reloadBar.style.overflow = 'hidden';
    reloadBar.style.display = 'none';

    const reloadFill = document.createElement('div');
    reloadFill.style.position = 'absolute';
    reloadFill.style.left = '0';
    reloadFill.style.top = '0';
    reloadFill.style.height = '100%';
    reloadFill.style.background = `rgba(255,255,255,${C.reloadBarAlpha})`;
    reloadBar.appendChild(reloadFill);

    const reloadSweep = document.createElement('div');
    reloadSweep.style.position = 'absolute';
    reloadSweep.style.top = `-${C.boxH - 1}px`;
    reloadSweep.style.width = C.reloadSweepWidth + 'px';
    reloadSweep.style.height = C.boxH + 'px';
    reloadSweep.style.background = 'rgba(255,255,255,0.12)';
    reloadSweep.style.display = 'none';
    reloadBar.appendChild(reloadSweep);

    ammoBase.root.appendChild(reloadBar);
    _ammo = { ...ammoBase, reloadBar, reloadFill, reloadSweep };
    _boxContainer.appendChild(_ammo.root);

    _money = createBoxEls();
    _boxContainer.appendChild(_money.root);

    const grenadeBase = createBoxEls();
    const pipsContainer = document.createElement('div');
    pipsContainer.style.position = 'absolute';
    pipsContainer.style.left = C.boxPad + 'px';
    pipsContainer.style.top = C.boxH + 'px';
    pipsContainer.style.display = 'flex';
    pipsContainer.style.gap = '2px';
    grenadeBase.root.appendChild(pipsContainer);
    _grenade = { ...grenadeBase, pipsContainer };
    _boxContainer.appendChild(_grenade.root);

    document.body.appendChild(_boxContainer);

    resetDirtyCache();
}

/** Tear down all diegetic HUD DOM elements. */
export function destroyDomDiegeticHud() {
    if (!_svgRoot) return;
    _svgRoot.remove();
    _svgRoot = null;
    _boxContainer!.remove();
    _boxContainer = null;
    document.body.classList.remove('renderer-dom');
    resetDirtyCache();
}

/**
 * Redraw all diegetic HUD elements for the current frame.
 * @param output - Pre-computed state from `tickDiegeticHud()`.
 */
export function updateDomDiegeticHud(output: DiegeticHudOutput) {
    if (!_svgRoot) return;

    const vis = output.visible ? '' : 'none';
    if (_svgRoot.style.display !== vis) _svgRoot.style.display = vis;
    if (_boxContainer!.style.display !== vis) _boxContainer!.style.display = vis;
    if (!output.visible) return;

    updateArcs(output);
    updateTetherAndBox(_tethers[0], _ammo, output.ammoBox);
    updateTetherAndBox(_tethers[1], _money, output.moneyBox);
    updateTetherAndBox(_tethers[2], _grenade, output.grenadeBox);
    updateAmmoSpecial(output.ammoBox);
    updateMoneySpecial(output.moneyBox);
    updateGrenadeSpecial(output.grenadeBox);
}

function updateArcs(output: DiegeticHudOutput) {
    const { arc } = output;
    const sc = worldToScreen(arc.cx, arc.cy);

    _ghostRing.setAttribute('cx', sc.x.toFixed(1));
    _ghostRing.setAttribute('cy', sc.y.toFixed(1));
    _ghostRing.setAttribute('r', String(arc.radius));

    const hpBgD = describeArc(sc.x, sc.y, arc.radius, arc.startAngle, arc.endAngle);
    _hpBg.setAttribute('d', hpBgD);

    const hpFrac = (arc.hpEndAngle - arc.startAngle) / C.arcSpan;
    if (hpFrac > 0.01) {
        const hpFillD = describeArc(sc.x, sc.y, arc.radius, arc.startAngle, arc.hpEndAngle);
        _hpFill.setAttribute('d', hpFillD);
        _hpFill.setAttribute('stroke', hexToRgba(arc.hpColor, arc.hpAlpha));
        _hpFill.style.display = '';

        const tipScreen = worldToScreen(arc.tipX, arc.tipY);
        _hpTip.setAttribute('cx', tipScreen.x.toFixed(1));
        _hpTip.setAttribute('cy', tipScreen.y.toFixed(1));
        _hpTip.setAttribute('fill', hexToRgba(arc.hpColor, arc.tipAlpha));
        _hpTip.style.display = '';
    }

    else {
        _hpFill.style.display = 'none';
        _hpTip.style.display = 'none';
    }

    const armorBgD = describeArc(sc.x, sc.y, arc.armorRadius, arc.startAngle, arc.endAngle);
    _armorBg.setAttribute('d', armorBgD);

    const armorFrac = (arc.armorEndAngle - arc.startAngle) / C.arcSpan;
    if (armorFrac > 0.01) {
        const armorFillD = describeArc(sc.x, sc.y, arc.armorRadius, arc.startAngle, arc.armorEndAngle);
        _armorFill.setAttribute('d', armorFillD);
        _armorFill.setAttribute('stroke', hexToRgba(C.armorColor, arc.armorAlpha));
        _armorFill.style.display = '';

        const atx = arc.cx + arc.armorRadius * Math.cos(arc.armorEndAngle);
        const aty = arc.cy + arc.armorRadius * Math.sin(arc.armorEndAngle);
        const atScreen = worldToScreen(atx, aty);
        _armorTip.setAttribute('cx', atScreen.x.toFixed(1));
        _armorTip.setAttribute('cy', atScreen.y.toFixed(1));
        _armorTip.setAttribute('fill', hexToRgba(C.armorColor, C.armorTipAlpha));
        _armorTip.style.display = '';
    }

    else {
        _armorFill.style.display = 'none';
        _armorTip.style.display = 'none';
    }
}

function updateTetherAndBox(tether: TetherEls, els: BoxEls, box: BoxOutput) {
    if (!box.visible) {
        els.root.style.display = 'none';
        tether.line.style.display = 'none';
        tether.dot.style.display = 'none';
        return;
    }

    els.root.style.display = 'flex';
    tether.line.style.display = '';
    tether.dot.style.display = '';

    const boxScreen = worldToScreen(box.worldX, box.worldY);
    const anchorScreen = worldToScreen(box.anchorX, box.anchorY);

    els.root.style.opacity = box.alpha.toFixed(3);
    els.root.style.transform = `translate3d(${(boxScreen.x - C.boxW / 2).toFixed(1)}px, ${(boxScreen.y - C.boxH / 2).toFixed(1)}px, 0)`;

    tether.line.setAttribute('x1', anchorScreen.x.toFixed(1));
    tether.line.setAttribute('y1', anchorScreen.y.toFixed(1));
    tether.line.setAttribute('x2', boxScreen.x.toFixed(1));
    tether.line.setAttribute('y2', boxScreen.y.toFixed(1));
    tether.line.style.opacity = box.alpha.toFixed(3);

    tether.dot.setAttribute('cx', anchorScreen.x.toFixed(1));
    tether.dot.setAttribute('cy', anchorScreen.y.toFixed(1));
    tether.dot.style.opacity = box.alpha.toFixed(3);

    els.value.style.color = hexToRgba(box.valueColor, C.boxValueAlpha);
}

function updateAmmoSpecial(box: AmmoBoxOutput) {
    if (!box.visible) return;

    if (box.label !== _lastAmmoLabel) {
        _lastAmmoLabel = box.label;
        _ammo.label.textContent = box.label;
    }

    if (box.value !== _lastAmmoValue) {
        _lastAmmoValue = box.value;
        _ammo.value.textContent = box.value;
    }

    if (box.showReloadBar) {
        _ammo.reloadBar.style.display = '';
        _ammo.reloadSweep.style.display = '';
        _ammo.reloadFill.style.width = (box.reloadFraction * C.boxW) + 'px';
        _ammo.reloadSweep.style.left = (box.reloadFraction * (C.boxW - C.reloadSweepWidth)) + 'px';
    }

    else {
        _ammo.reloadBar.style.display = 'none';
        _ammo.reloadSweep.style.display = 'none';
    }

    if (box.emptyPulse) {
        const pulse = 0.4 + box.emptyPulsePhase * 0.35;
        _ammo.root.style.background = hexToRgba(C.emptyPulseStrokeColor, pulse * 0.12);
        _ammo.root.style.borderColor = hexToRgba(C.emptyPulseStrokeColor, pulse);
        _ammo.root.style.borderWidth = C.emptyPulseStrokeWidth + 'px';
    }

    else {
        _ammo.root.style.background = hexToRgba(C.boxBgColor, C.boxBgAlpha);
        _ammo.root.style.borderColor = hexToRgba(C.boxStrokeColor, C.boxStrokeAlpha);
        _ammo.root.style.borderWidth = C.boxStrokeWidth + 'px';
    }
}

function updateGrenadeSpecial(box: GrenadeBoxOutput) {
    if (!box.visible) return;

    if (box.label !== _lastGrenadeLabel) {
        _lastGrenadeLabel = box.label;
        _grenade.label.textContent = box.label;
    }

    if (box.value !== _lastGrenadeValue) {
        _lastGrenadeValue = box.value;
        _grenade.value.textContent = box.value;
    }

    if (box.pips.length > 1) {
        if (box.pips.length !== _lastPipCount) {
            _lastPipCount = box.pips.length;
            _grenade.pipsContainer.innerHTML = '';
            for (let i = 0; i < box.pips.length; i++) {
                const pip = document.createElement('span');
                pip.style.display = 'inline-block';
                pip.style.borderRadius = '50%';
                _grenade.pipsContainer.appendChild(pip);
            }
        }

        const children = _grenade.pipsContainer.children;
        for (let i = 0; i < box.pips.length; i++) {
            const pip = children[i] as HTMLElement;

            if (box.pips[i].active) {
                pip.style.width = '4px';
                pip.style.height = '4px';
                pip.style.background = hexToRgba(C.hpColorHigh, 0.7);
                pip.style.border = 'none';
            }

            else {
                pip.style.width = '2.6px';
                pip.style.height = '2.6px';
                pip.style.background = 'none';
                pip.style.border = `0.5px solid ${hexToRgba(C.hpColorHigh, 0.25)}`;
            }
        }

        _grenade.pipsContainer.style.display = 'flex';
    }

    else {
        _grenade.pipsContainer.style.display = 'none';
    }
}

function updateMoneySpecial(box: BoxOutput) {
    if (!box.visible) return;

    _money.label.textContent = box.label;

    if (box.value !== _lastMoneyValue) {
        _lastMoneyValue = box.value;
        _money.value.textContent = box.value;
    }
}
