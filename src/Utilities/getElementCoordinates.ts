import { MAP_OFFSET } from '../main';

export function getElementCoordinates(targetElement: HTMLElement): elementCoordinates {
    let box = targetElement.getBoundingClientRect();
    return {
        x: box.left + window.pageXOffset - MAP_OFFSET,
        y: box.top + window.pageYOffset - MAP_OFFSET,
        top: box.top + window.pageYOffset - MAP_OFFSET,
        right: box.right + window.pageXOffset - MAP_OFFSET,
        bottom: box.bottom + window.pageYOffset - MAP_OFFSET,
        left: box.left + window.pageXOffset - MAP_OFFSET,
    };
}
