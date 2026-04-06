import { SETTINGS } from '../main';
import { ACTIVE_PLAYER, getPlayerInfo } from '../Globals/Players';
import { HALF_HIT_BOX } from '../constants';

const MAX_HEARING_DISTANCE = 1500;
const ROLLOFF_FACTOR = 1.5;
const REFERENCE_DISTANCE = 40;
const bufferCache = new Map<string, AudioBuffer>();
const footstepTimers = new Map<number, number>();
const FOOTSTEP_INTERVAL = 300;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicSource: AudioBufferSourceNode | null = null;

// Gain hierarchy:
//   sfx source -> spatialGain -> sfxGain -\
//                                          masterGain -> destination
//   music source -----------> musicGain -/

function getContext(): AudioContext {
    if (!ctx) {
        ctx = new AudioContext();

        masterGain = ctx.createGain();
        masterGain.gain.value = SETTINGS.audio.muted ? 0 : SETTINGS.audio.masterVolume;
        masterGain.connect(ctx.destination);

        sfxGain = ctx.createGain();
        sfxGain.gain.value = SETTINGS.audio.sfxVolume;
        sfxGain.connect(masterGain);

        musicGain = ctx.createGain();
        musicGain.gain.value = SETTINGS.audio.musicVolume;
        musicGain.connect(masterGain);
    }
    return ctx;
}

export function resumeAudioContext() {
    const c = getContext();
    if (c.state === 'suspended') c.resume();
}

export function setMasterVolume(v: number) {
    SETTINGS.audio.masterVolume = v;
    if (masterGain && !SETTINGS.audio.muted) masterGain.gain.value = v;
}

export function setSfxVolume(v: number) {
    SETTINGS.audio.sfxVolume = v;
    if (sfxGain) sfxGain.gain.value = v;
}

export function setMusicVolume(v: number) {
    SETTINGS.audio.musicVolume = v;
    if (musicGain) musicGain.gain.value = v;
}

export function setMuted(muted: boolean) {
    SETTINGS.audio.muted = muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : SETTINGS.audio.masterVolume;
}

export async function loadSound(id: string, url: string): Promise<void> {
    if (bufferCache.has(id)) return;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`[Audio] Missing sound file: ${url}`);
            return;
        }
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await getContext().decodeAudioData(arrayBuffer);
        bufferCache.set(id, audioBuffer);
    } catch (e) {
        console.warn(`[Audio] Failed to load ${id} from ${url}:`, e);
    }
}

export function playSound(id: string, position?: { x: number; y: number }) {
    const buffer = bufferCache.get(id);
    if (!buffer) return;

    const c = getContext();
    if (c.state === 'suspended') return;

    let spatialFactor = 1;
    if (position) {
        const listener = ACTIVE_PLAYER ? getPlayerInfo(ACTIVE_PLAYER) : null;
        if (listener) {
            const lx = listener.current_position.x + HALF_HIT_BOX;
            const ly = listener.current_position.y + HALF_HIT_BOX;
            const dx = position.x - lx;
            const dy = position.y - ly;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > MAX_HEARING_DISTANCE) return;
            const clamped = Math.max(dist, REFERENCE_DISTANCE);
            spatialFactor = REFERENCE_DISTANCE / (REFERENCE_DISTANCE + ROLLOFF_FACTOR * (clamped - REFERENCE_DISTANCE));
        }
    }

    const source = c.createBufferSource();
    source.buffer = buffer;

    const gain = c.createGain();
    gain.gain.value = Math.max(0, Math.min(1, spatialFactor));
    source.connect(gain);
    gain.connect(sfxGain!);
    source.start();
}

export function playMenuMusic() {
    const buffer = bufferCache.get('menu-music');
    if (!buffer) return;

    stopMenuMusic();

    const c = getContext();
    musicSource = c.createBufferSource();
    musicSource.buffer = buffer;
    musicSource.loop = true;
    musicSource.connect(musicGain!);
    musicSource.start();
}

export function stopMenuMusic() {
    if (musicSource) {
        try {
            musicSource.stop();
        } catch (_) {
            /* already stopped */
        }
        musicSource.disconnect();
        musicSource = null;
    }
}

export function playSoundAtPlayer(id: string, player: player_info) {
    playSound(id, {
        x: player.current_position.x + HALF_HIT_BOX,
        y: player.current_position.y + HALF_HIT_BOX,
    });
}

export function playFootstep(player: player_info, timestamp: number) {
    const last = footstepTimers.get(player.id) ?? 0;
    if (timestamp - last < FOOTSTEP_INTERVAL) return;
    footstepTimers.set(player.id, timestamp);
    playSoundAtPlayer('footstep', player);
}
