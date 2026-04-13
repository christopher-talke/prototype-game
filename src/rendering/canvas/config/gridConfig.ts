import type { GridQuality } from './graphicsConfig';

// Quality-managed fields (spacing, dot/line rendering) are written by
// applyGraphicsConfig().  Physics fields below are preset-independent.
export const gridConfig = {
    spacing: 42,
    springK: 18,
    damping: 9,
    maxDisplacement: 28,
    velocityEpsilon: 0.01,
    displacementEpsilon: 0.01,
    maxDt: 1 / 30,
    playerWakeRadius: 100,
    playerWakeStrength: 200,
    playerSpeedThreshold: 0.5,
    playerSpeedDivisor: 200,

    // Grid rendering (quality-managed by GraphicsConfig)
    dotBaseAlpha: 0.1,
    dotDisplaceAlpha: 0.6,
    dotBaseRadius: 1.0,
    dotDisplaceRadius: 1.2,
    lineAlpha: 0.05,
    lineWidth: 1,
};

type AssertExtends<_T extends _Q, _Q> = true;
export type _GridOk = AssertExtends<typeof gridConfig, GridQuality>;
