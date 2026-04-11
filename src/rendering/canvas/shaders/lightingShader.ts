import { Shader, GlProgram, GpuProgram, MeshGeometry, Mesh, Texture } from 'pixi.js';

// --- Constants ---
const MAX_LIGHTS = 32;
const MAX_WALLS = 128;

// ============================================================
// GLSL ES 3.0 (WebGL2) -- PixiJS auto-inserts #version 300 es
// ============================================================

const GLSL_VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vWorldUV;

void main() {
    gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
    vWorldUV = aPosition;
}
`;

const GLSL_FRAG = /* glsl */ `
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
// WGSL (WebGPU)
// ============================================================

const WGSL_SOURCE = /* wgsl */ `
struct LightingUniforms {
    uAmbientColor: vec3<f32>,
    uLightCount: i32,
    uWallCount: i32,
    uFalloffExp: f32,
    uCoreSharpness: f32,
    uWorldSize: vec2<f32>,
    uLightPosData: array<vec4<f32>, ${MAX_LIGHTS}>,
    uLightColorData: array<vec4<f32>, ${MAX_LIGHTS}>,
    uLightSpotData: array<vec4<f32>, ${MAX_LIGHTS}>,
    uWalls: array<vec4<f32>, ${MAX_WALLS}>,
};

@group(0) @binding(0) var<uniform> uniforms: LightingUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) vWorldUV: vec2<f32>,
};

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(aPosition * 2.0 - 1.0, 0.0, 1.0);
    output.vWorldUV = aPosition;
    return output;
}

fn shadowAABB(origin: vec2<f32>, dir: vec2<f32>, maxDist: f32, wall: vec4<f32>) -> f32 {
    let wMin = wall.xy;
    let wMax = wall.xy + wall.zw;
    let invDir = 1.0 / dir;
    let t1 = (wMin - origin) * invDir;
    let t2 = (wMax - origin) * invDir;
    let tNear = min(t1, t2);
    let tFar  = max(t1, t2);
    let tEnter = max(tNear.x, tNear.y);
    let tExit  = min(tFar.x, tFar.y);
    if (tEnter < tExit && tExit > 0.0 && tEnter > 0.001 && tEnter < maxDist) {
        return 0.0;
    }
    return 1.0;
}

fn sceneShadow(origin: vec2<f32>, lightPos: vec2<f32>, dist: f32) -> f32 {
    let dir = normalize(lightPos - origin);
    var shadow: f32 = 1.0;
    for (var w: i32 = 0; w < ${MAX_WALLS}; w++) {
        if (w >= uniforms.uWallCount) { break; }
        shadow *= shadowAABB(origin, dir, dist, uniforms.uWalls[w]);
        if (shadow <= 0.0) { break; }
    }
    return shadow;
}

fn insideAnyWall(pos: vec2<f32>) -> bool {
    for (var w: i32 = 0; w < ${MAX_WALLS}; w++) {
        if (w >= uniforms.uWallCount) { break; }
        let wMin = uniforms.uWalls[w].xy;
        let wMax = uniforms.uWalls[w].xy + uniforms.uWalls[w].zw;
        if (pos.x >= wMin.x && pos.x <= wMax.x && pos.y >= wMin.y && pos.y <= wMax.y) {
            return true;
        }
    }
    return false;
}

@fragment
fn mainFragment(input: VertexOutput) -> @location(0) vec4<f32> {
    let worldPos = input.vWorldUV * uniforms.uWorldSize;
    var totalLight = uniforms.uAmbientColor;

    if (insideAnyWall(worldPos)) {
        return vec4<f32>(totalLight / (totalLight + vec3<f32>(1.0)), 1.0);
    }

    for (var i: i32 = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uniforms.uLightCount) { break; }

        let lightPos  = uniforms.uLightPosData[i].xy;
        let radius    = uniforms.uLightPosData[i].z;
        let bloomRad  = uniforms.uLightPosData[i].w;
        let color     = uniforms.uLightColorData[i].rgb;
        let hasShadow = uniforms.uLightColorData[i].a;

        let dist = distance(worldPos, lightPos);
        if (dist > radius) { continue; }

        let spotDir    = uniforms.uLightSpotData[i].xy;
        let cosHalf    = uniforms.uLightSpotData[i].z;
        let spotOuter  = uniforms.uLightSpotData[i].w;
        var spotMask: f32 = 1.0;
        if (cosHalf > 0.0) {
            let toFrag = normalize(worldPos - lightPos);
            let d = dot(toFrag, spotDir);
            spotMask = smoothstep(spotOuter, cosHalf, d);
        }

        let t = dist / radius;
        let edge = pow(1.0 - t * t, uniforms.uFalloffExp);
        let core = bloomRad / (dist + uniforms.uCoreSharpness * bloomRad);
        let bloom = edge * core * spotMask;
        var shadow: f32 = 1.0;
        if (hasShadow > 0.5) {
            shadow = sceneShadow(worldPos, lightPos, dist);
        }

        totalLight += color * bloom * shadow;
    }

    return vec4<f32>(totalLight / (totalLight + vec3<f32>(1.0)), 1.0);
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

    const gpuProgram = GpuProgram.from({
        vertex: { source: WGSL_SOURCE, entryPoint: 'mainVertex' },
        fragment: { source: WGSL_SOURCE, entryPoint: 'mainFragment' },
    });

    
    return new Shader({
        glProgram,
        gpuProgram,
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
