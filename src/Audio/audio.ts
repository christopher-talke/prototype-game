import { SETTINGS } from '../main';
import { ACTIVE_PLAYER, getPlayerInfo } from '../Globals/Players';
import { HALF_HIT_BOX } from '../constants';

const MAX_HEARING_DISTANCE = 800;
const ROLLOFF_FACTOR = 2.5;
const REFERENCE_DISTANCE = 40;
const bufferCache = new Map<string, AudioBuffer>();
const footstepTimers = new Map<number, number>(); // playerId -> last footstep timestamp
const FOOTSTEP_INTERVAL = 300;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getContext(): AudioContext {
    if (!ctx) {
        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
    }
    return ctx;
}

export function resumeAudioContext() {
    const c = getContext();
    if (c.state === 'suspended') {
        c.resume();
    }
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

export function playSound(
    id: string,
    position?: { x: number; y: number },
) {
    if (SETTINGS.audio.muted) return;

    const buffer = bufferCache.get(id);
    if (!buffer) return;

    const c = getContext();
    if (c.state === 'suspended') return;

    const source = c.createBufferSource();
    source.buffer = buffer;

    const gain = c.createGain();
    let volume = SETTINGS.audio.masterVolume * SETTINGS.audio.sfxVolume;

    // Spatial attenuation - inverse distance with rolloff
    if (position) {
        const listener = ACTIVE_PLAYER ? getPlayerInfo(ACTIVE_PLAYER) : null;
        if (listener) {
            const lx = listener.current_position.x + HALF_HIT_BOX;
            const ly = listener.current_position.y + HALF_HIT_BOX;
            const dx = position.x - lx;
            const dy = position.y - ly;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > MAX_HEARING_DISTANCE) return;
            // Inverse distance with rolloff: ref / (ref + rolloff * (dist - ref))
            const clamped = Math.max(dist, REFERENCE_DISTANCE);
            volume *= REFERENCE_DISTANCE / (REFERENCE_DISTANCE + ROLLOFF_FACTOR * (clamped - REFERENCE_DISTANCE));
        }
    }

    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(masterGain!);
    source.start();
}

export function playSoundAtPlayer(id: string, player: player_info) {
    playSound(id, {
        x: player.current_position.x + HALF_HIT_BOX,
        y: player.current_position.y + HALF_HIT_BOX,
    });
}

// Throttled footstep - returns true if a footstep was played
export function playFootstep(player: player_info, timestamp: number) {
    const last = footstepTimers.get(player.id) ?? 0;
    if (timestamp - last < FOOTSTEP_INTERVAL) return;
    footstepTimers.set(player.id, timestamp);
    playSoundAtPlayer('footstep', player);
}
