/**
 * Removes all DOM elements in a NodeList from the document.
 * No-op if the list is null.
 * @param elements - A NodeList of elements to remove, or null.
 */
export function removeElements(elements: NodeListOf<Element> | null) {
    if (elements) {
        Array.from(elements).forEach((el) => el.remove());
    }
}
