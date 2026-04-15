import { SETTINGS } from '../app';
import { ACTIVE_PLAYER, getPlayerInfo } from '@simulation/player/playerRegistry';
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

/**
 * Lazily initializes and returns the shared AudioContext. On first call,
 * creates the gain node chain: source -> sfx/music -> master -> destination.
 */
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

/** Resumes the AudioContext if suspended (required after user interaction). */
export function resumeAudioContext() {
    const c = getContext();
    if (c.state === 'suspended') c.resume();
}

/**
 * Sets the master volume and persists it to `SETTINGS`.
 * @param v - Volume level (0-1)
 */
export function setMasterVolume(v: number) {
    SETTINGS.audio.masterVolume = v;
    if (masterGain && !SETTINGS.audio.muted) masterGain.gain.value = v;
}

/**
 * Sets the SFX sub-mix volume and persists it to `SETTINGS`.
 * @param v - Volume level (0-1)
 */
export function setSfxVolume(v: number) {
    SETTINGS.audio.sfxVolume = v;
    if (sfxGain) sfxGain.gain.value = v;
}

/**
 * Sets the music sub-mix volume and persists it to `SETTINGS`.
 * @param v - Volume level (0-1)
 */
export function setMusicVolume(v: number) {
    SETTINGS.audio.musicVolume = v;
    if (musicGain) musicGain.gain.value = v;
}

/**
 * Mutes or unmutes all audio by zeroing the master gain node.
 * @param muted - Whether audio should be muted
 */
export function setMuted(muted: boolean) {
    SETTINGS.audio.muted = muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : SETTINGS.audio.masterVolume;
}

/**
 * Fetches and decodes a sound file, caching the resulting AudioBuffer
 * by `id`. Subsequent calls with the same id are no-ops.
 * @param id - Unique sound identifier used for playback lookups
 * @param url - URL of the audio file to fetch
 */
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

/**
 * Plays a cached sound effect. When a world position is provided,
 * applies distance-based attenuation relative to the local player
 * using inverse-distance rolloff. Sounds beyond `MAX_HEARING_DISTANCE`
 * are culled entirely.
 * @param id - Sound identifier matching a previously loaded buffer
 * @param position - Optional world-space position for spatial falloff
 */
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

/** Starts looping the menu background music track. Stops any existing playback first. */
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

/** Stops the menu music if currently playing. */
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

/**
 * Convenience wrapper that plays a sound at a player's center position.
 * @param id - Sound identifier
 * @param player - Player whose position is used for spatial attenuation
 */
export function playSoundAtPlayer(id: string, player: player_info) {
    playSound(id, {
        x: player.current_position.x + HALF_HIT_BOX,
        y: player.current_position.y + HALF_HIT_BOX,
    });
}

/**
 * Plays a footstep sound for a player, throttled to one per
 * `FOOTSTEP_INTERVAL` ms to avoid overlapping samples.
 * @param player - The moving player
 * @param timestamp - Current frame timestamp (ms)
 */
export function playFootstep(player: player_info, timestamp: number) {
    const last = footstepTimers.get(player.id) ?? 0;
    if (timestamp - last < FOOTSTEP_INTERVAL) return;
    footstepTimers.set(player.id, timestamp);
    playSoundAtPlayer('footstep', player);
}
