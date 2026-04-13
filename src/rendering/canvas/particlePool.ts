import { Sprite, Texture, Container } from 'pixi.js';

// --- Texture generation ---

const TEXTURE_SIZE = 64;

function generateSoftCircle(size: number, falloff: number = 2.0): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, `rgba(255,255,255,${Math.pow(0.7, falloff)})`);
    grad.addColorStop(0.7, `rgba(255,255,255,${Math.pow(0.3, falloff)})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return Texture.from(canvas);
}

function generateHardDot(size: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const half = size / 2;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    return Texture.from(canvas);
}

function generateShard(size: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const half = size / 2;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(size * 0.8, half * 0.6);
    ctx.lineTo(size * 0.7, size);
    ctx.lineTo(size * 0.2, size * 0.7);
    ctx.lineTo(0, half * 0.3);
    ctx.closePath();
    ctx.fill();
    return Texture.from(canvas);
}

function generateStreak(width: number, height: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.3, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return Texture.from(canvas);
}

function generateSoftBlob(size: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return Texture.from(canvas);
}

// --- Texture atlas ---

export let texSoftCircle: Texture;
export let texHardDot: Texture;
export let texShard: Texture;
export let texStreak: Texture;
export let texSoftBlob: Texture;
export let texSoftCircleLarge: Texture;

export function initParticleTextures() {
    texSoftCircle = generateSoftCircle(TEXTURE_SIZE);
    texHardDot = generateHardDot(16);
    texShard = generateShard(24);
    texStreak = generateStreak(32, 6);
    texSoftBlob = generateSoftBlob(TEXTURE_SIZE);
    texSoftCircleLarge = generateSoftCircle(128, 1.5);
}

// --- SoA Particle Bank ---

export interface ParticleBank {
    x: Float32Array;
    y: Float32Array;
    vx: Float32Array;
    vy: Float32Array;
    scale: Float32Array;
    rotation: Float32Array;
    alpha: Float32Array;
    elapsed: Float32Array;
    duration: Float32Array;
    alive: Uint8Array;
    sprites: Sprite[];
    freeStack: number[];
    aliveCount: number;
    capacity: number;
    container: Container;
}

export function createParticleBank(capacity: number, texture: Texture, container: Container, blendMode?: string): ParticleBank {
    const bank: ParticleBank = {
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        vx: new Float32Array(capacity),
        vy: new Float32Array(capacity),
        scale: new Float32Array(capacity),
        rotation: new Float32Array(capacity),
        alpha: new Float32Array(capacity),
        elapsed: new Float32Array(capacity),
        duration: new Float32Array(capacity),
        alive: new Uint8Array(capacity),
        sprites: new Array(capacity),
        freeStack: new Array(capacity),
        aliveCount: 0,
        capacity,
        container,
    };

    for (let i = 0; i < capacity; i++) {
        const s = new Sprite(texture);
        s.anchor.set(0.5);
        s.visible = false;
        s.cullable = true;
        if (blendMode) s.blendMode = blendMode as any;
        container.addChild(s);
        bank.sprites[i] = s;
        bank.freeStack[i] = capacity - 1 - i; // fill in reverse so pop gives 0,1,2...
    }

    return bank;
}

export function acquireParticle(bank: ParticleBank): number {
    if (bank.freeStack.length === 0) return -1;
    const idx = bank.freeStack.pop()!;
    bank.alive[idx] = 1;
    bank.elapsed[idx] = 0;
    bank.sprites[idx].visible = true;
    bank.aliveCount++;
    return idx;
}

export function releaseParticle(bank: ParticleBank, idx: number) {
    if (!bank.alive[idx]) return;
    bank.alive[idx] = 0;
    bank.sprites[idx].visible = false;
    bank.freeStack.push(idx);
    bank.aliveCount--;
}

export function syncSprite(bank: ParticleBank, idx: number) {
    const s = bank.sprites[idx];
    s.x = bank.x[idx];
    s.y = bank.y[idx];
    s.scale.set(bank.scale[idx]);
    s.rotation = bank.rotation[idx];
    s.alpha = bank.alpha[idx];
}

// --- Bank-level iteration helpers ---

export type ParticleUpdater = (bank: ParticleBank, idx: number, dt: number) => boolean; // return false to kill

export function updateBank(bank: ParticleBank, dt: number, updater: ParticleUpdater) {
    for (let i = bank.capacity - 1; i >= 0; i--) {
        if (!bank.alive[i]) continue;
        bank.elapsed[i] += dt;
        if (bank.elapsed[i] >= bank.duration[i] || !updater(bank, i, dt)) {
            releaseParticle(bank, i);
            continue;
        }
        syncSprite(bank, i);
    }
}

export function clearBank(bank: ParticleBank) {
    for (let i = 0; i < bank.capacity; i++) {
        if (bank.alive[i]) releaseParticle(bank, i);
    }
}
