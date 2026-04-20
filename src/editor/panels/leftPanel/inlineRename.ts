/**
 * Shared inline-rename helper for layer rows and item rows. Replaces the
 * target label element with a focused input; commits on blur/Enter, cancels
 * on Escape.
 *
 * Part of the editor layer.
 */

/**
 * Begin an inline rename on `target`. Replaces it with an input, focuses and
 * selects its text. Commits via `commit(next)` on Enter/blur; Escape restores
 * the original label without calling commit.
 */
export function beginInlineRename(
    target: HTMLElement,
    current: string,
    commit: (next: string) => void,
): void {
    const original = target;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'editor-layer-rename-input';
    target.replaceWith(input);
    input.focus();
    input.select();

    let cancelled = false;

    const finish = (save: boolean): void => {
        const next = input.value.trim();
        const restored = document.createElement('span');
        restored.className = original.className;
        restored.textContent = save && next ? next : current;
        input.replaceWith(restored);
        if (save && next && next !== current) commit(next);
    };

    input.addEventListener('blur', () => {
        if (cancelled) return;
        finish(true);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelled = true;
            finish(false);
        }
    });
}
