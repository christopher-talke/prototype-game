/**
 * PixiJS v8 custom lighting shader for the 2D world-space lightmap.
 *
 * Implements per-pixel Reinhard-tonemapped lighting with hard polygon-edge
 * shadows (ray-vs-segment intersection), spotlight cone masks, and bloom
 * falloff. Compiled once and reused across frames via LightingManager.
 *
 * Rendering layer - canvas sub-system, consumed exclusively by lightingManager.ts.
 */

import { Shader, GlProgram, MeshGeometry, Mesh, Texture } from 'pixi.js';

import { MAX_GPU_LIGHTS, MAX_GPU_SEGMENTS } from '../renderConstants';

const MAX_LIGHTS = MAX_GPU_LIGHTS;
const MAX_SEGMENTS = MAX_GPU_SEGMENTS;

// GLSL ES 3.0 (WebGL2) -- PixiJS auto-inserts #version 300 es

/**
 * Vertex shader is a simple pass-through that transforms normalized UV coordinates to world space and passes them to the fragment shader.
 */
const GLSL_VERT = `
in vec2 aPosition;
out vec2 vWorldUV;

void main() {
    gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
    vWorldUV = aPosition;
}
`;

/**
 * Fragment shader implements a 2D lighting model with support for multiple
 * point and spotlight sources, hard shadows from polygon edges via
 * ray-vs-segment intersection, and Reinhard tonemapping. Each wall edge is
 * packed into a vec4 (x1, y1, x2, y2). Non-axis-aligned walls cast correct
 * oblique shadows.
 */
const GLSL_FRAG = `
precision highp float;

in vec2 vWorldUV;
out vec4 finalColor;

uniform vec3 uAmbientColor;
uniform vec2 uWorldSize;
uniform int uLightCount;
uniform int uSegmentCount;
uniform float uFalloffExp;
uniform float uCoreSharpness;
uniform vec4 uLightPosData[${MAX_LIGHTS}];
uniform vec4 uLightColorData[${MAX_LIGHTS}];
uniform vec4 uLightSpotData[${MAX_LIGHTS}];
uniform vec4 uSegments[${MAX_SEGMENTS}];

float shadowSegment(vec2 origin, vec2 dir, float maxDist, vec4 seg) {
    vec2 A = seg.xy;
    vec2 B = seg.zw;
    vec2 S = B - A;
    float denom = dir.x * S.y - dir.y * S.x;
    if (abs(denom) < 1e-6) return 1.0;
    vec2 rel = A - origin;
    float t = (rel.x * S.y - rel.y * S.x) / denom;
    float u = (rel.x * dir.y - rel.y * dir.x) / denom;
    if (t > 0.5 && t < maxDist - 0.5 && u >= 0.0 && u <= 1.0) {
        return 0.0;
    }
    return 1.0;
}

float sceneShadow(vec2 origin, vec2 lightPos, float dist) {
    vec2 dir = (lightPos - origin) / dist;
    float shadow = 1.0;
    for (int s = 0; s < ${MAX_SEGMENTS}; s++) {
        if (s >= uSegmentCount) break;
        shadow *= shadowSegment(origin, dir, dist, uSegments[s]);
        if (shadow <= 0.0) break;
    }
    return shadow;
}

void main() {
    vec2 worldPos = vWorldUV * uWorldSize;
    vec3 totalLight = uAmbientColor;

    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;

        vec2 lightPos  = uLightPosData[i].xy;
        float radius   = uLightPosData[i].z;
        float bloomRad = uLightPosData[i].w;
        vec3 color     = uLightColorData[i].rgb;
        float hasShadow = uLightColorData[i].a;

        float dist = distance(worldPos, lightPos);
        if (dist > radius) continue;

        // Spotlight cone mask
        vec2 spotDir    = uLightSpotData[i].xy;
        float cosHalf   = uLightSpotData[i].z;
        float spotOuter = uLightSpotData[i].w;
        float spotMask  = 1.0;
        if (cosHalf > 0.0) {
            vec2 toFrag = normalize(worldPos - lightPos);
            float d = dot(toFrag, spotDir);
            spotMask = smoothstep(spotOuter, cosHalf, d);
        }

        float t = dist / radius;
        float edge = pow(1.0 - t * t, uFalloffExp);
        float core = bloomRad / (dist + uCoreSharpness * bloomRad);
        float bloom = edge * core * spotMask;
        float shadow = 1.0;
        if (hasShadow > 0.5) {
            shadow = sceneShadow(worldPos, lightPos, dist);
        }

        totalLight += color * bloom * shadow;
    }

    // Reinhard tonemap -- lets bright lights bloom past 1.0 without hard clamp
    finalColor = vec4(totalLight / (totalLight + vec3(1.0)), 1.0);
}
`;

/**
 * Creates a PixiJS Shader instance configured with the world-space lighting
 * program and all required uniform buffers pre-allocated.
 *
 * @returns A shader ready for attachment to a full-screen lightmap Mesh
 */
export function createLightingShader(): Shader {
    const glProgram = GlProgram.from({
        vertex: GLSL_VERT,
        fragment: GLSL_FRAG,
        name: 'lighting-shader',
    });

    return new Shader({
        glProgram,
        resources: {
            lightingUniforms: {
                uAmbientColor: { value: new Float32Array(3), type: 'vec3<f32>' },
                uLightCount: { value: 0, type: 'i32' },
                uSegmentCount: { value: 0, type: 'i32' },
                uFalloffExp: { value: 2.0, type: 'f32' },
                uCoreSharpness: { value: 0.3, type: 'f32' },
                uWorldSize: { value: new Float32Array(2), type: 'vec2<f32>' },
                uLightPosData: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
                uLightColorData: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
                uLightSpotData: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
                uSegments: { value: new Float32Array(MAX_SEGMENTS * 4), type: 'vec4<f32>', size: MAX_SEGMENTS },
            },
        },
    });
}

/**
 * Creates a full-screen quad Mesh that covers the entire world in UV [0,1] space.
 * The mesh is rendered with the lighting shader to produce the lightmap texture.
 *
 * @param shader - The lighting Shader returned by createLightingShader
 * @returns A PixiJS Mesh covering [0,0] to [1,1] in normalized UV coordinates
 */
export function createLightingMesh(shader: Shader): Mesh {
    const geometry = new MeshGeometry({
        positions: new Float32Array([
            0, 0,
            1, 0,
            1, 1,
            0, 1,
        ]),
        uvs: new Float32Array([
            0, 0,
            1, 0,
            1, 1,
            0, 1,
        ]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });

    return new Mesh({ geometry, shader: shader as any, texture: Texture.WHITE });
}
