import { GlowFilter } from 'pixi-filters';
import { Ticker } from 'pixi.js';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import { getPixiPlayerContainer } from './playerRenderer';
import { getPlayerInfo } from '@simulation/player/playerRegistry';
import { TEAM_COLORS } from './teamColors';
import { CRITICAL_HEALTH_COLOR } from './renderConstants';

const GLOW_DISTANCE = 8;
const GLOW_QUALITY = 0.3;
const NORMAL_STRENGTH = 1.0;
const SPIKE_BASE = 2.5;
const SPIKE_DAMAGE_SCALE = 2.5;
const SPIKE_DECAY_MS = 300;
const DEATH_DRAIN_MS = 400;
const RESPAWN_FADE_MS = 500;
const LOW_HP_THRESHOLD = 50;
const CRITICAL_HP_THRESHOLD = 25;
const PULSE_FREQ = 2 * Math.PI * 2 / 1000; // 2 Hz in rad/ms

interface GlowState {
    filter: GlowFilter;
    team: number;
    damageSpikeRemaining: number;
    damageSpikeIntensity: number;
    lowHealthPulsePhase: number;
    deathDrainRemaining: number;
    deathDrainStart: number;
    respawnFadeRemaining: number;
    lastKnownHealth: number;
}

const glowStates = new Map<number, GlowState>();

function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16) |
           (Math.round(ag + (bg - ag) * t) << 8) |
           Math.round(ab + (bb - ab) * t);
}

function getTeamColor(team: number): number {
    return TEAM_COLORS[team] ?? 0xffffff;
}

function baseStrengthForHealth(hp: number, team: number): { strength: number; color: number } {
    if (hp < CRITICAL_HP_THRESHOLD) {
        return { strength: NORMAL_STRENGTH + 0.5, color: CRITICAL_HEALTH_COLOR };
    }
    if (hp < LOW_HP_THRESHOLD) {
        const redFactor = 1 - hp / LOW_HP_THRESHOLD;
        return {
            strength: NORMAL_STRENGTH + 0.5 * redFactor,
            color: lerpColor(getTeamColor(team), CRITICAL_HEALTH_COLOR, redFactor),
        };
    }
    return { strength: NORMAL_STRENGTH, color: getTeamColor(team) };
}

function handleEvent(event: GameEvent) {
    switch (event.type) {
        case 'PLAYER_DAMAGED': {
            const state = glowStates.get(event.targetId);
            if (!state) break;
            state.damageSpikeRemaining = SPIKE_DECAY_MS;
            state.damageSpikeIntensity = SPIKE_BASE + (event.damage / 100) * SPIKE_DAMAGE_SCALE;
            state.lastKnownHealth = event.newHealth;
            break;
        }
        case 'PLAYER_KILLED': {
            const state = glowStates.get(event.targetId);
            if (!state) break;
            state.deathDrainRemaining = DEATH_DRAIN_MS;
            state.deathDrainStart = state.filter.outerStrength;
            state.damageSpikeRemaining = 0;
            break;
        }
        case 'PLAYER_RESPAWN': {
            const state = glowStates.get(event.playerId);
            if (!state) break;
            state.respawnFadeRemaining = RESPAWN_FADE_MS;
            state.deathDrainRemaining = 0;
            state.damageSpikeRemaining = 0;
            state.lowHealthPulsePhase = 0;
            state.lastKnownHealth = 100;
            break;
        }
        case 'ROUND_START': {
            for (const [, state] of glowStates) {
                state.damageSpikeRemaining = 0;
                state.deathDrainRemaining = 0;
                state.respawnFadeRemaining = 0;
                state.lowHealthPulsePhase = 0;
                state.lastKnownHealth = 100;
                state.filter.outerStrength = NORMAL_STRENGTH;
                state.filter.color = getTeamColor(state.team);
            }
            break;
        }
    }
}

function tick(dt: number) {
    for (const [playerId, state] of glowStates) {

        if (state.deathDrainRemaining > 0) {
            state.deathDrainRemaining -= dt;
            if (state.deathDrainRemaining <= 0) {
                state.filter.outerStrength = 0;
                state.deathDrainRemaining = 0;
            } else {
                const t = 1 - state.deathDrainRemaining / DEATH_DRAIN_MS;
                state.filter.outerStrength = state.deathDrainStart * (1 - t);
            }
            continue;
        }

        if (state.respawnFadeRemaining > 0) {
            state.respawnFadeRemaining -= dt;
            if (state.respawnFadeRemaining <= 0) {
                state.filter.outerStrength = NORMAL_STRENGTH;
                state.filter.color = getTeamColor(state.team);
                state.respawnFadeRemaining = 0;
            } else {
                const t = 1 - state.respawnFadeRemaining / RESPAWN_FADE_MS;
                state.filter.outerStrength = NORMAL_STRENGTH * t;
                state.filter.color = getTeamColor(state.team);
            }
            continue;
        }

        if (state.damageSpikeRemaining > 0) {
            state.damageSpikeRemaining -= dt;
            if (state.damageSpikeRemaining <= 0) {
                state.damageSpikeRemaining = 0;
                // Fall through to normal/low-health below
            } else {
                const t = state.damageSpikeRemaining / SPIKE_DECAY_MS;
                const eased = t * t; // ease-out: fast decay then slow
                const base = baseStrengthForHealth(state.lastKnownHealth, state.team);
                state.filter.outerStrength = base.strength + (state.damageSpikeIntensity - base.strength) * eased;
                state.filter.color = lerpColor(base.color, 0xffffff, eased);
                continue;
            }
        }

        const info = getPlayerInfo(playerId);
        const hp = info?.health ?? state.lastKnownHealth;
        state.lastKnownHealth = hp;

        if (hp < CRITICAL_HP_THRESHOLD) {
            state.lowHealthPulsePhase += dt * PULSE_FREQ;
            const pulse = 0.5 + 0.5 * Math.sin(state.lowHealthPulsePhase);
            state.filter.outerStrength = 0.6 + 1.4 * pulse;
            state.filter.color = CRITICAL_HEALTH_COLOR;
        } else if (hp < LOW_HP_THRESHOLD) {
            const redFactor = 1 - hp / LOW_HP_THRESHOLD;
            state.filter.outerStrength = NORMAL_STRENGTH + 0.5 * redFactor;
            state.filter.color = lerpColor(getTeamColor(state.team), CRITICAL_HEALTH_COLOR, redFactor);
            state.lowHealthPulsePhase = 0;
        } else {
            state.filter.outerStrength = NORMAL_STRENGTH;
            state.filter.color = getTeamColor(state.team);
            state.lowHealthPulsePhase = 0;
        }
    }
}

export function initPlayerGlowManager() {
    gameEventBus.subscribe(handleEvent);
    Ticker.shared.add((ticker) => tick(ticker.deltaMS));
}

export function onPlayerGlowCreated(playerId: number, team: number) {
    const container = getPixiPlayerContainer(playerId);
    if (!container) return;

    const filter = new GlowFilter({
        color: getTeamColor(team),
        innerStrength: 0,
        outerStrength: 0,
        distance: GLOW_DISTANCE,
        quality: GLOW_QUALITY,
        alpha: 0.5,
    });
    filter.resolution = 2;

    container.filters = [filter];

    glowStates.set(playerId, {
        filter,
        team,
        damageSpikeRemaining: 0,
        damageSpikeIntensity: 0,
        lowHealthPulsePhase: 0,
        deathDrainRemaining: 0,
        deathDrainStart: 0,
        respawnFadeRemaining: RESPAWN_FADE_MS, // fade in on creation
        lastKnownHealth: 100,
    });
}

export function clearPlayerGlows() {
    for (const [, state] of glowStates) {
        state.filter.destroy();
    }
    glowStates.clear();
}
