/**
 * PixiJS rendering layer for the diegetic HUD.
 *
 * Creates Graphics and Text objects in `diegeticHudLayer` (above lighting,
 * always visible). Each frame `updatePixiDiegeticHud()` redraws arcs and
 * repositions tethered info boxes based on output from the state module.
 *
 * Part of the canvas rendering layer. Consumed by `renderPipeline.ts`.
 */

import { Container, Graphics, Text } from 'pixi.js';

import { diegeticHudLayer } from '@rendering/canvas/sceneGraph';
import { diegeticHudConfig as C } from './diegeticHudConfig';
import type { DiegeticHudOutput, BoxOutput, AmmoBoxOutput, GrenadeBoxOutput } from './diegeticHudState';

let _root: Container | null = null;
let _arcGfx: Graphics;
let _armorArcGfx: Graphics;
let _ghostRingGfx: Graphics;
let _tipDotGfx: Graphics;
let _tetherGfx: Graphics;

interface BoxDisplay {
    container: Container;
    bg: Graphics;
    label: Text;
    value: Text;
}

let _ammoDisplay: BoxDisplay;
let _ammoReloadBar: Graphics;
let _moneyDisplay: BoxDisplay;
let _grenadeDisplay: BoxDisplay;
let _grenadePipGfx: Graphics;

let _lastAmmoLabel = '';
let _lastAmmoValue = '';
let _lastMoneyValue = '';
let _lastGrenadeLabel = '';
let _lastGrenadeValue = '';

const FONT_FAMILY = "'Share Tech Mono', 'Courier New', monospace";

/**
 * Create all PixiJS display objects for the diegetic HUD and add them
 * to the scene graph. Idempotent - returns immediately if already initialized.
 */
export function initPixiDiegeticHud() {
    if (_root) return;

    _root = new Container();
    _root.label = 'diegeticHud';
    diegeticHudLayer.addChild(_root);

    _ghostRingGfx = new Graphics();
    _root.addChild(_ghostRingGfx);

    _armorArcGfx = new Graphics();
    _root.addChild(_armorArcGfx);

    _arcGfx = new Graphics();
    _root.addChild(_arcGfx);

    _tipDotGfx = new Graphics();
    _root.addChild(_tipDotGfx);

    _tetherGfx = new Graphics();
    _root.addChild(_tetherGfx);

    _ammoReloadBar = new Graphics();
    _ammoDisplay = createBoxDisplay('ammoBox');
    _ammoDisplay.container.addChild(_ammoReloadBar);

    _moneyDisplay = createBoxDisplay('moneyBox');
    _grenadeDisplay = createBoxDisplay('grenadeBox');

    _grenadePipGfx = new Graphics();
    _grenadeDisplay.container.addChild(_grenadePipGfx);

    resetDirtyCache();
}

/** Tear down all diegetic HUD display objects. */
export function destroyPixiDiegeticHud() {
    if (!_root) return;
    _root.destroy({ children: true });
    _root = null;
    resetDirtyCache();
}

function resetDirtyCache() {
    _lastAmmoLabel = '';
    _lastAmmoValue = '';
    _lastMoneyValue = '';
    _lastGrenadeLabel = '';
    _lastGrenadeValue = '';
}

function createBoxDisplay(label: string): BoxDisplay {
    const container = new Container();
    container.label = label;

    const bg = new Graphics();
    container.addChild(bg);

    const labelText = new Text({
        text: '',
        style: {
            fontFamily: FONT_FAMILY,
            fontSize: C.boxLabelFontSize,
            fill: C.boxStrokeColor,
        },
    });
    labelText.alpha = C.boxLabelAlpha;
    labelText.anchor.set(0, 0.5);
    container.addChild(labelText);

    const valueText = new Text({
        text: '',
        style: {
            fontFamily: FONT_FAMILY,
            fontSize: C.boxValueFontSize,
            fill: C.boxStrokeColor,
        },
    });
    valueText.alpha = C.boxValueAlpha;
    valueText.anchor.set(1, 0.5);
    container.addChild(valueText);

    _root!.addChild(container);

    return { container, bg, label: labelText, value: valueText };
}

/**
 * Redraw all diegetic HUD elements for the current frame.
 * @param output - Pre-computed state from `tickDiegeticHud()`.
 */
export function updatePixiDiegeticHud(output: DiegeticHudOutput) {
    if (!_root) return;

    _root.visible = output.visible;
    if (!output.visible) return;

    const { arc } = output;

    _ghostRingGfx.clear();
    _ghostRingGfx.circle(arc.cx, arc.cy, arc.radius);
    _ghostRingGfx.stroke({ color: C.hpColorHigh, width: 0.5, alpha: C.ghostRingAlpha });

    _arcGfx.clear();
    _arcGfx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle);
    _arcGfx.stroke({ color: C.hpColorHigh, width: C.arcStrokeWidth, alpha: 0.08 });

    const hpFrac = (arc.hpEndAngle - arc.startAngle) / C.arcSpan;
    if (hpFrac > 0.01) {
        _arcGfx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.hpEndAngle);
        _arcGfx.stroke({ color: arc.hpColor, width: C.arcStrokeWidth, alpha: arc.hpAlpha });
    }

    _tipDotGfx.clear();
    if (hpFrac > 0.01) {
        _tipDotGfx.circle(arc.tipX, arc.tipY, C.tipDotRadius);
        _tipDotGfx.fill({ color: arc.hpColor, alpha: arc.tipAlpha });
    }

    _armorArcGfx.clear();
    _armorArcGfx.arc(arc.cx, arc.cy, arc.armorRadius, arc.startAngle, arc.endAngle);
    _armorArcGfx.stroke({ color: C.armorColor, width: C.armorStrokeWidth, alpha: 0.06 });

    const armorFrac = (arc.armorEndAngle - arc.startAngle) / C.arcSpan;
    if (armorFrac > 0.01) {
        _armorArcGfx.arc(arc.cx, arc.cy, arc.armorRadius, arc.startAngle, arc.armorEndAngle);
        _armorArcGfx.stroke({ color: C.armorColor, width: C.armorStrokeWidth, alpha: arc.armorAlpha });

        const atx = arc.cx + arc.armorRadius * Math.cos(arc.armorEndAngle);
        const aty = arc.cy + arc.armorRadius * Math.sin(arc.armorEndAngle);
        _armorArcGfx.circle(atx, aty, C.tipDotRadius * 0.7);
        _armorArcGfx.fill({ color: C.armorColor, alpha: C.armorTipAlpha });
    }

    _tetherGfx.clear();

    updateAmmoBox(output.ammoBox);
    updateMoneyBox(output.moneyBox);
    updateGrenadeBox(output.grenadeBox);
}

function updateAmmoBox(box: AmmoBoxOutput) {
    const d = _ammoDisplay;
    d.container.visible = box.visible;
    if (!box.visible) return;

    d.container.alpha = box.alpha;
    positionBox(d, box);
    drawTether(box);
    drawBoxBackground(d.bg);

    _ammoReloadBar.clear();
    if (box.showReloadBar) {
        const sl = -C.boxW / 2;
        const barW = C.boxW * box.reloadFraction;
        _ammoReloadBar.rect(sl, C.boxH / 2 - 1, barW, 1);
        _ammoReloadBar.fill({ color: 0xffffff, alpha: C.reloadBarAlpha });

        const sweepX = sl + box.reloadFraction * (C.boxW - C.reloadSweepWidth);
        _ammoReloadBar.rect(sweepX, -C.boxH / 2, C.reloadSweepWidth, C.boxH);
        _ammoReloadBar.fill({ color: 0xffffff, alpha: 0.12 });
    }

    if (box.emptyPulse) {
        const pulse = 0.4 + box.emptyPulsePhase * 0.35;
        d.bg.clear();
        d.bg.roundRect(-C.boxW / 2, -C.boxH / 2, C.boxW, C.boxH, 1);
        d.bg.fill({ color: C.emptyPulseStrokeColor, alpha: pulse * 0.12 });
        d.bg.stroke({ color: C.emptyPulseStrokeColor, width: C.emptyPulseStrokeWidth, alpha: pulse });
    }

    if (box.label !== _lastAmmoLabel) {
        _lastAmmoLabel = box.label;
        d.label.text = box.label;
    }

    if (box.value !== _lastAmmoValue) {
        _lastAmmoValue = box.value;
        d.value.text = box.value;
    }

    d.value.style.fill = box.valueColor;
}

function updateMoneyBox(box: BoxOutput) {
    const d = _moneyDisplay;
    d.container.visible = box.visible;
    if (!box.visible) return;

    d.container.alpha = box.alpha;
    positionBox(d, box);
    drawTether(box);
    drawBoxBackground(d.bg);

    d.label.text = box.label;

    if (box.value !== _lastMoneyValue) {
        _lastMoneyValue = box.value;
        d.value.text = box.value;
    }

    d.value.style.fill = box.valueColor;
}

function updateGrenadeBox(box: GrenadeBoxOutput) {
    const d = _grenadeDisplay;
    d.container.visible = box.visible;
    if (!box.visible) return;

    d.container.alpha = box.alpha;
    positionBox(d, box);
    drawTether(box);
    drawBoxBackground(d.bg);

    if (box.label !== _lastGrenadeLabel) {
        _lastGrenadeLabel = box.label;
        d.label.text = box.label;
    }

    if (box.value !== _lastGrenadeValue) {
        _lastGrenadeValue = box.value;
        d.value.text = box.value;
    }

    d.value.style.fill = box.valueColor;

    _grenadePipGfx.clear();
    if (box.pips.length > 1) {
        const pipY = C.boxH / 2 + 5;
        const pipStartX = -C.boxW / 2 + C.boxPad;
        for (let i = 0; i < box.pips.length; i++) {
            const pip = box.pips[i];
            const px = pipStartX + i * 6;

            if (pip.active) {
                _grenadePipGfx.circle(px, pipY, 2);
                _grenadePipGfx.fill({ color: C.hpColorHigh, alpha: 0.7 });
            }

            else {
                _grenadePipGfx.circle(px, pipY, 1.3);
                _grenadePipGfx.stroke({ color: C.hpColorHigh, width: 0.5, alpha: 0.25 });
            }
        }
    }
}

function positionBox(d: BoxDisplay, box: BoxOutput) {
    d.container.x = box.worldX;
    d.container.y = box.worldY;
    d.label.x = -C.boxW / 2 + C.boxPad;
    d.label.y = 1;
    d.value.x = C.boxW / 2 - C.boxPad;
    d.value.y = 1;
}

function drawBoxBackground(bg: Graphics) {
    bg.clear();
    bg.roundRect(-C.boxW / 2, -C.boxH / 2, C.boxW, C.boxH, 1);
    bg.fill({ color: C.boxBgColor, alpha: C.boxBgAlpha });
    bg.stroke({ color: C.boxStrokeColor, width: C.boxStrokeWidth, alpha: C.boxStrokeAlpha });
}

function drawTether(box: BoxOutput) {
    const dx = box.worldX - box.anchorX;
    const dy = box.worldY - box.anchorY;
    const totalLen = Math.sqrt(dx * dx + dy * dy);
    if (totalLen < 1) return;

    const nx = dx / totalLen;
    const ny = dy / totalLen;
    const step = C.tetherDash + C.tetherGap;

    for (let offset = 0; offset < totalLen; offset += step) {
        const end = Math.min(offset + C.tetherDash, totalLen);
        const sx = box.anchorX + nx * offset;
        const sy = box.anchorY + ny * offset;
        const ex = box.anchorX + nx * end;
        const ey = box.anchorY + ny * end;
        _tetherGfx.moveTo(sx, sy);
        _tetherGfx.lineTo(ex, ey);
    }
    _tetherGfx.stroke({ color: C.hpColorHigh, width: C.tetherWidth, alpha: C.tetherAlpha });

    _tetherGfx.circle(box.anchorX, box.anchorY, C.tetherAnchorRadius);
    _tetherGfx.fill({ color: C.hpColorHigh, alpha: C.tetherAnchorAlpha });
}
