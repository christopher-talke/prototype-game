import type { ParticleQuality } from './graphicsConfig';

// Quality-managed fields are written by applyGraphicsConfig().
// largeSoftCircleFalloff is a design constant, not quality-managed.
export const particleConfig = {
    textureSize: 64,
    largeSoftCircleSize: 128,
    largeSoftCircleFalloff: 1.5,
    hardDotSize: 16,
    shardSize: 24,
    streakWidth: 32,
    streakHeight: 6,
};

type AssertExtends<_T extends _Q, _Q> = true;
export type _ParticleOk = AssertExtends<typeof particleConfig, ParticleQuality>;
