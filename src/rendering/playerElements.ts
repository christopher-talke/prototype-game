const PLAYER_ELEMENTS = new Map<number, HTMLElement>();
const HEALTH_BAR_ELEMENTS = new Map<number, HTMLElement>();
const NAMETAG_ELEMENTS = new Map<number, HTMLElement>();

export function registerPlayerElement(playerId: number, element: HTMLElement) {
    PLAYER_ELEMENTS.set(playerId, element);
}

export function getPlayerElement(playerId: number): HTMLElement | undefined {
    return PLAYER_ELEMENTS.get(playerId);
}

export function registerHealthBarElement(playerId: number, element: HTMLElement) {
    HEALTH_BAR_ELEMENTS.set(playerId, element);
}

export function getHealthBarElement(playerId: number): HTMLElement | undefined {
    return HEALTH_BAR_ELEMENTS.get(playerId);
}

export function registerNametagElement(playerId: number, element: HTMLElement) {
    NAMETAG_ELEMENTS.set(playerId, element);
}

export function getNametagElement(playerId: number): HTMLElement | undefined {
    return NAMETAG_ELEMENTS.get(playerId);
}

export function updateActivePlayerVisual(oldId: number | null, newId: number) {
    if (oldId != null) {
        PLAYER_ELEMENTS.get(oldId)?.classList.remove('visible');
    }
    PLAYER_ELEMENTS.get(newId)?.classList.add('visible');
}

export function clearPlayerElements() {
    PLAYER_ELEMENTS.clear();
    HEALTH_BAR_ELEMENTS.clear();
    NAMETAG_ELEMENTS.clear();
}
