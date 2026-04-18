/**
 * Collapsible advanced section: GUID + copy button. Visible only on
 * single-selection.
 *
 * Part of the editor layer.
 */

/** Build a collapsible <details> with the GUID and a copy button. */
export function buildAdvancedSection(guid: string): HTMLElement {
    const details = document.createElement('details');
    details.className = 'editor-advanced-section';

    const summary = document.createElement('summary');
    summary.textContent = 'Advanced';
    details.appendChild(summary);

    const row = document.createElement('div');
    row.className = 'editor-advanced-row';

    const label = document.createElement('span');
    label.className = 'editor-advanced-label';
    label.textContent = 'GUID';
    row.appendChild(label);

    const text = document.createElement('span');
    text.className = 'editor-advanced-guid';
    text.textContent = guid;
    row.appendChild(text);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'editor-advanced-copy';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
        void navigator.clipboard?.writeText(guid);
    });
    row.appendChild(copy);

    details.appendChild(row);
    return details;
}
