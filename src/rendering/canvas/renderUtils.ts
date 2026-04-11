/** O(1) removal from an unordered array. Swaps element at index with the last element, then pops. */
export function swapRemove<T>(arr: T[], index: number): void {
    const last = arr.length - 1;
    if (index !== last) arr[index] = arr[last];
    arr.pop();
}
