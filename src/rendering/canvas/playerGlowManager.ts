import { GlowFilter } from 'pixi-filters';
import { Ticker } from 'pixi.js';
import { gameEventBus, type GameEvent } from '@net/gameEvent';
import { getPixiPlayerContainer } from './playerRenderer';
import { getPlayerInfo } from '@simulation/player/playerRegistry';
import { TEAM_COLORS } from './teamColors';
import { CRITICAL_HEALTH_COLOR } from './renderConstants';
import { glowConfig } from './config/glowConfig';
import { getGraphicsConfig } from './config/graphicsConfig';
import { getPixiCameraOffset } from './camera';

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
    const ar = (a >> 16) & 0xff,
        ag = (a >> 8) & 0xff,
        ab = a & 0xff;
    const br = (b >> 16) & 0xff,
        bg = (b >> 8) & 0xff,
        bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function getTeamColor(team: number): number {
    return TEAM_COLORS[team] ?? 0xffffff;
}

function baseStrengthForHealth(hp: number, team: number): { strength: number; color: number } {
    if (hp < glowConfig.criticalHpThreshold) {
        return { strength: glowConfig.normalStrength + 0.5, color: CRITICAL_HEALTH_COLOR };
    }
    if (hp < glowConfig.lowHpThreshold) {
        const redFactor = 1 - hp / glowConfig.lowHpThreshold;
        return {
            strength: glowConfig.normalStrength + 0.5 * redFactor,
            color: lerpColor(getTeamColor(team), CRITICAL_HEALTH_COLOR, redFactor),
        };
    }
    return { strength: glowConfig.normalStrength, color: getTeamColor(team) };
}

function handleEvent(event: GameEvent) {
    switch (event.type) {
        case 'PLAYER_DAMAGED': {
            const state = glowStates.get(event.targetId);
            if (!state) break;
            state.damageSpikeRemaining = glowConfig.spikeDecayMs;
            state.damageSpikeIntensity = glowConfig.spikeBase + (event.damage / 100) * glowConfig.spikeDamageScale;
            state.lastKnownHealth = event.newHealth;
            break;
        }
        case 'PLAYER_KILLED': {
            const state = glowStates.get(event.targetId);
            if (!state) break;
            state.deathDrainRemaining = glowConfig.deathDrainMs;
            state.deathDrainStart = state.filter.outerStrength;
            state.damageSpikeRemaining = 0;
            break;
        }
        case 'PLAYER_RESPAWN': {
            const state = glowStates.get(event.playerId);
            if (!state) break;
            state.respawnFadeRemaining = glowConfig.respawnFadeMs;
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
                state.filter.outerStrength = glowConfig.normalStrength;
                state.filter.color = getTeamColor(state.team);
            }
            break;
        }
    }
}

function tick(dt: number) {
    const cam = getPixiCameraOffset();
    const vpW = window.visualViewport?.width ?? window.innerWidth;
    const vpH = window.visualViewport?.height ?? window.innerHeight;
    const glowMargin = glowConfig.distance + 50; // glow extends beyond sprite

    for (const [playerId, state] of glowStates) {
        const container = getPixiPlayerContainer(playerId);
        if (container) {
            const isAnimating = (
                state.deathDrainRemaining > 0 || 
                state.respawnFadeRemaining > 0 || 
                state.damageSpikeRemaining > 0
            );

            if (!isAnimating) {
                const info = getPlayerInfo(playerId);
                if (info) {
                    const px = info.current_position.x;
                    const py = info.current_position.y;
                    const onScreen = px >= cam.x - glowMargin && px <= cam.x + vpW + glowMargin
                        && py >= cam.y - glowMargin && py <= cam.y + vpH + glowMargin;
                    if (!onScreen) {
                        if (container.filters) container.filters = null;
                        continue;
                    }
                }
            }

            if (!container.filters || container.filters.length === 0) {
                container.filters = [state.filter];
            }
        }

        if (state.deathDrainRemaining > 0) {

            state.deathDrainRemaining -= dt;
            if (state.deathDrainRemaining <= 0) {
                state.filter.outerStrength = 0;
                state.deathDrainRemaining = 0;
            } 
            
            else {
                const t = 1 - state.deathDrainRemaining / glowConfig.deathDrainMs;
                state.filter.outerStrength = state.deathDrainStart * (1 - t);
            }

            continue;
        }

        if (state.respawnFadeRemaining > 0) {

            state.respawnFadeRemaining -= dt;
            if (state.respawnFadeRemaining <= 0) {
                state.filter.outerStrength = glowConfig.normalStrength;
                state.filter.color = getTeamColor(state.team);
                state.respawnFadeRemaining = 0;
            } 
            
            else {
                const t = 1 - state.respawnFadeRemaining / glowConfig.respawnFadeMs;
                state.filter.outerStrength = glowConfig.normalStrength * t;
                state.filter.color = getTeamColor(state.team);
            }
            continue;
        }

        if (state.damageSpikeRemaining > 0) {

            state.damageSpikeRemaining -= dt;
            if (state.damageSpikeRemaining <= 0) {
                state.damageSpikeRemaining = 0;
            } 
            
            else {
                const t = state.damageSpikeRemaining / glowConfig.spikeDecayMs;
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

        if (hp < glowConfig.criticalHpThreshold) {
            state.lowHealthPulsePhase += dt * ((2 * Math.PI * glowConfig.pulseFreqHz) / 1000);
            const pulse = 0.5 + 0.5 * Math.sin(state.lowHealthPulsePhase);
            state.filter.outerStrength = 0.6 + 1.4 * pulse;
            state.filter.color = CRITICAL_HEALTH_COLOR;
        } 
        
        else if (hp < glowConfig.lowHpThreshold) {
            const redFactor = 1 - hp / glowConfig.lowHpThreshold;
            state.filter.outerStrength = glowConfig.normalStrength + 0.5 * redFactor;
            state.filter.color = lerpColor(getTeamColor(state.team), CRITICAL_HEALTH_COLOR, redFactor);
            state.lowHealthPulsePhase = 0;
        } 
        
        else {
            state.filter.outerStrength = glowConfig.normalStrength;
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
    if (!getGraphicsConfig().features.glowFilter) return;
    const container = getPixiPlayerContainer(playerId);
    if (!container) return;

    const filter = new GlowFilter({
        color: getTeamColor(team),
        innerStrength: 0,
        outerStrength: 0,
        distance: glowConfig.distance,
        quality: glowConfig.quality,
        alpha: 0.5,
    });
    filter.resolution = glowConfig.filterResolution;

    container.filters = [filter];

    glowStates.set(playerId, {
        filter,
        team,
        damageSpikeRemaining: 0,
        damageSpikeIntensity: 0,
        lowHealthPulsePhase: 0,
        deathDrainRemaining: 0,
        deathDrainStart: 0,
        respawnFadeRemaining: glowConfig.respawnFadeMs, // fade in on creation
        lastKnownHealth: 100,
    });
}

export function clearPlayerGlows() {
    for (const [, state] of glowStates) {
        state.filter.destroy();
    }
    glowStates.clear();
}
