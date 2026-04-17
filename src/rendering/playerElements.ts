/**
 * Shared registry of player DOM elements used by the DOM renderer.
 * Rendering layer -- maps player IDs to their visual element references
 * so that visibility, health bars, and nametags can be updated each frame
 * without DOM queries.
 */

const PLAYER_ELEMENTS = new Map<number, HTMLElement>();
const HEALTH_BAR_ELEMENTS = new Map<number, HTMLElement>();
const NAMETAG_ELEMENTS = new Map<number, HTMLElement>();

/** Stores a player's root DOM element for later retrieval by ID. */
export function registerPlayerElement(playerId: number, element: HTMLElement) {
    PLAYER_ELEMENTS.set(playerId, element);
}

export function getPlayerElement(playerId: number): HTMLElement | undefined {
    return PLAYER_ELEMENTS.get(playerId);
}

/** Stores a player's health bar element for later retrieval by ID. */
export function registerHealthBarElement(playerId: number, element: HTMLElement) {
    HEALTH_BAR_ELEMENTS.set(playerId, element);
}

export function getHealthBarElement(playerId: number): HTMLElement | undefined {
    return HEALTH_BAR_ELEMENTS.get(playerId);
}

/** Stores a player's nametag element for later retrieval by ID. */
export function registerNametagElement(playerId: number, element: HTMLElement) {
    NAMETAG_ELEMENTS.set(playerId, element);
}

export function getNametagElement(playerId: number): HTMLElement | undefined {
    return NAMETAG_ELEMENTS.get(playerId);
}

/**
 * Swaps the 'visible' CSS class from the old active player to the new one.
 * @param oldId - Player ID to remove visibility from, or null if none was active.
 * @param newId - Player ID to mark as the locally-controlled visible player.
 */
export function updateActivePlayerVisual(oldId: number | null, newId: number) {
    if (oldId != null) {
        PLAYER_ELEMENTS.get(oldId)?.classList.remove('visible');
    }
    PLAYER_ELEMENTS.get(newId)?.classList.add('visible');
}

/** Removes all stored element references. Called on renderer teardown. */
export function clearPlayerElements() {
    PLAYER_ELEMENTS.clear();
    HEALTH_BAR_ELEMENTS.clear();
    NAMETAG_ELEMENTS.clear();
}
