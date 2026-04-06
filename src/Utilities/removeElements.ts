export function removeElements(elements: NodeListOf<Element> | null) {
    if (elements) {
        Array.from(elements).forEach((el) => el.remove());
    }
    return;
}
