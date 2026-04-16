/**
 * Design constants for the diegetic (in-world) HUD.
 *
 * Covers health/armor arcs, tethered info boxes, spring physics,
 * auto-fade timers, ammo state colors, and reload bar styling.
 *
 * Part of the rendering layer. Consumed by `diegeticHudState.ts` and
 * `pixiDiegeticHud.ts`.
 */
export const diegeticHudConfig = {
    arcRadius: 46,
    arcSpan: Math.PI / 2,
    arcStrokeWidth: 4.5,
    tipDotRadius: 3,
    ghostRingAlpha: 0.04,
    hpColorHigh: 0x00c8e1,
    hpColorMid: 0x007a8a,
    hpColorLow: 0xd74132,
    hpHighThreshold: 60,
    hpMidThreshold: 30,
    hpAlphaHigh: 0.6,
    hpAlphaMid: 0.35,
    hpAlphaLow: 0.65,
    tipAlphaHigh: 0.9,
    tipAlphaMid: 0.6,
    tipAlphaLow: 0.9,

    armorArcRadius: 40,
    armorStrokeWidth: 3,
    armorColor: 0x60a5fa,
    armorAlpha: 0.5,
    armorTipAlpha: 0.8,

    boxW: 100,
    boxH: 24,
    boxPad: 8,
    boxTether: 58,
    boxMargin: 14,
    boxBgColor: 0x050c14,
    boxBgAlpha: 0.92,
    boxStrokeColor: 0x00c8e1,
    boxStrokeAlpha: 0.18,
    boxStrokeWidth: 0.5,
    boxLabelFontSize: 11,
    boxLabelAlpha: 0.5,
    boxValueFontSize: 13,
    boxValueAlpha: 0.75,
    tetherAlpha: 0.3,
    tetherWidth: 0.75,
    tetherDash: 3,
    tetherGap: 5,
    tetherAnchorRadius: 1.5,
    tetherAnchorAlpha: 0.4,

    spring: 0.08,
    edgePad: 8,
    playerPushPad: 6,

    ammoShowMs: 4000,
    ammoFadeMs: 1000,
    subShowMs: 3000,
    subFadeMs: 800,

    ammoLowThreshold: 7,
    ammoMidThreshold: 15,
    ammoLowColor: 0xd74132,
    ammoMidColor: 0xf5b937,
    ammoNormalColor: 0x00c8e1,
    emptyPulseSpeed: 0.012,
    emptyPulseStrokeColor: 0xd74132,
    emptyPulseStrokeWidth: 1.2,

    reloadSweepWidth: 8,
    reloadBarAlpha: 0.3,
};
