import { Shader, GlProgram, MeshGeometry, Mesh, Texture } from 'pixi.js';
import { MAX_GPU_LIGHTS, MAX_GPU_WALLS } from '../renderConstants';

// --- Constants ---
const MAX_LIGHTS = MAX_GPU_LIGHTS;
const MAX_WALLS = MAX_GPU_WALLS;

// ============================================================
// GLSL ES 3.0 (WebGL2) -- PixiJS auto-inserts #version 300 es
// ============================================================

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
 * Fragment shader implements a 2D lighting model with support for multiple point and spotlight sources, hard shadows from axis-aligned rectangular walls, and Reinhard tonemapping for high dynamic range. 
 * It calculates per-pixel lighting by iterating over all lights, applying distance-based falloff, spotlight cone masks, and shadow checks against the scene geometry. 
 * The shader is designed to be efficient by using uniform arrays with a maximum count for lights and walls, allowing the CPU to batch updates and minimize draw calls.
 */
const GLSL_FRAG = `
precision highp float;

in vec2 vWorldUV;
out vec4 finalColor;

uniform vec3 uAmbientColor;
uniform vec2 uWorldSize;
uniform int uLightCount;
uniform int uWallCount;
uniform float uFalloffExp;
uniform float uCoreSharpness;
uniform vec4 uLightPosData[${MAX_LIGHTS}];
uniform vec4 uLightColorData[${MAX_LIGHTS}];
uniform vec4 uLightSpotData[${MAX_LIGHTS}];
uniform vec4 uWalls[${MAX_WALLS}];

float shadowAABB(vec2 origin, vec2 dir, float maxDist, vec4 wall) {
    vec2 wMin = wall.xy;
    vec2 wMax = wall.xy + wall.zw;
    vec2 invDir = 1.0 / dir;
    vec2 t1 = (wMin - origin) * invDir;
    vec2 t2 = (wMax - origin) * invDir;
    vec2 tNear = min(t1, t2);
    vec2 tFar  = max(t1, t2);
    float tEnter = max(tNear.x, tNear.y);
    float tExit  = min(tFar.x, tFar.y);
    if (tEnter < tExit && tExit > 0.0 && tEnter > 0.001 && tEnter < maxDist) {
        return 0.0;
    }
    return 1.0;
}

float sceneShadow(vec2 origin, vec2 lightPos, float dist) {
    vec2 dir = normalize(lightPos - origin);
    float shadow = 1.0;
    for (int w = 0; w < ${MAX_WALLS}; w++) {
        if (w >= uWallCount) break;
        shadow *= shadowAABB(origin, dir, dist, uWalls[w]);
        if (shadow <= 0.0) break;
    }
    return shadow;
}

bool insideAnyWall(vec2 pos) {
    for (int w = 0; w < ${MAX_WALLS}; w++) {
        if (w >= uWallCount) break;
        vec2 wMin = uWalls[w].xy;
        vec2 wMax = uWalls[w].xy + uWalls[w].zw;
        if (pos.x >= wMin.x && pos.x <= wMax.x && pos.y >= wMin.y && pos.y <= wMax.y) {
            return true;
        }
    }
    return false;
}

void main() {
    vec2 worldPos = vWorldUV * uWorldSize;
    vec3 totalLight = uAmbientColor;

    if (insideAnyWall(worldPos)) {
        finalColor = vec4(totalLight / (totalLight + vec3(1.0)), 1.0);
        return;
    }

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

// ============================================================
// Factory functions
// ============================================================

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
                uWallCount: { value: 0, type: 'i32' },
                uFalloffExp: { value: 2.0, type: 'f32' },
                uCoreSharpness: { value: 0.3, type: 'f32' },
                uWorldSize: { value: new Float32Array(2), type: 'vec2<f32>' },
                uLightPosData: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
                uLightColorData: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
                uLightSpotData: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
                uWalls: { value: new Float32Array(MAX_WALLS * 4), type: 'vec4<f32>', size: MAX_WALLS },
            },
        },
    });
}

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
