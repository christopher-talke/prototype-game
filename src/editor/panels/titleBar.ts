/**
 * Title bar state: map name + dirty asterisk.
 *
 * Writes to both `document.title` and the in-bar `#editor-map-title` element
 * so the user sees the dirty marker whether the tab is in focus or not.
 *
 * Part of the editor layer.
 */

export interface TitleState {
    name: string;
    dirty: boolean;
}

export class TitleBar {
    constructor(private readonly element: HTMLElement) {}

    update(state: TitleState): void {
        const label = `${state.name}${state.dirty ? '*' : ''}`;
        this.element.textContent = label;
        document.title = `${label} - Sightline Map Editor`;
    }
}
