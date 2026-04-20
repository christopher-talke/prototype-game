/**
 * Map Properties modal dialog. Edits meta, bounds, postProcess, and audio
 * fields. Commits changes via a SnapshotCommand dispatched through the caller.
 *
 * Part of the editor layer.
 */

import type { EditorWorkingState } from '../../state/EditorWorkingState';
import type { EditorCommand } from '../../commands/EditorCommand';
import { buildSetMapPropertiesCommand } from '../../commands/setMapMetaCommand';

/** Open the Map Properties modal. Calls `onDispatch` if the user saves. */
export function openMapPropertiesDialog(
    state: EditorWorkingState,
    onDispatch: (cmd: EditorCommand) => void,
): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'editor-modal-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'editor-modal';
    backdrop.appendChild(modal);

    const title = document.createElement('div');
    title.className = 'editor-modal-title';
    title.textContent = 'Map Properties';
    modal.appendChild(title);

    const body = document.createElement('div');
    body.className = 'editor-modal-body';
    modal.appendChild(body);

    const { meta, bounds, postProcess, audio } = state.map;

    // --- Meta ---
    addSection(body, 'Meta');
    const nameInput = addField(body, 'Map Name', meta.name, 'text');
    const authorInput = addField(body, 'Author', meta.author, 'text');
    const minInput = addField(body, 'Player Count (min)', String(meta.playerCount.min), 'number');
    const recInput = addField(body, 'Recommended', String(meta.playerCount.recommended), 'number');
    const maxInput = addField(body, 'Player Count (max)', String(meta.playerCount.max), 'number');

    // --- Bounds ---
    addSection(body, 'Bounds');
    const mapWidthInput = addField(body, 'Map Width', String(bounds.width), 'number');
    const mapHeightInput = addField(body, 'Map Height', String(bounds.height), 'number');
    const paXInput = addField(body, 'Playable X', String(bounds.playableArea.x), 'number');
    const paYInput = addField(body, 'Playable Y', String(bounds.playableArea.y), 'number');
    const paWInput = addField(body, 'Playable Width', String(bounds.playableArea.width), 'number');
    const paHInput = addField(body, 'Playable Height', String(bounds.playableArea.height), 'number');
    const oobInput = addField(body, 'OOB Kill Margin', String(bounds.oobKillMargin), 'number');

    // --- Post-Process ---
    addSection(body, 'Post-Process');
    const bloomInput = addField(body, 'Bloom Intensity', String(postProcess.bloomIntensity), 'number');
    const caInput = addField(body, 'Chromatic Aberration', String(postProcess.chromaticAberration), 'number');
    const [alrInput, algInput, albInput] = addRgbField(
        body,
        'Ambient Light Color',
        postProcess.ambientLightColor,
    );
    const aliInput = addField(body, 'Ambient Intensity', String(postProcess.ambientLightIntensity), 'number');
    const vigInput = addField(body, 'Vignette Intensity', String(postProcess.vignetteIntensity), 'number');

    // --- Audio ---
    addSection(body, 'Audio');
    const ambientLoopInput = addField(body, 'Ambient Loop', audio.ambientLoop ?? '', 'text');
    ambientLoopInput.placeholder = 'asset path or empty';
    const reverbInput = addField(body, 'Reverb Profile', audio.reverbProfile, 'text');

    // --- Footer ---
    const footer = document.createElement('div');
    footer.className = 'editor-modal-footer';
    modal.appendChild(footer);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'editor-modal-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    footer.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'editor-modal-btn primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        const cmd = buildSetMapPropertiesCommand(state, {
            meta: {
                name: nameInput.value.trim() || meta.name,
                author: authorInput.value.trim(),
                playerCount: {
                    min: parseInt(minInput.value, 10) || meta.playerCount.min,
                    recommended: parseInt(recInput.value, 10) || meta.playerCount.recommended,
                    max: parseInt(maxInput.value, 10) || meta.playerCount.max,
                },
            },
            bounds: {
                width: parseFloat(mapWidthInput.value) || bounds.width,
                height: parseFloat(mapHeightInput.value) || bounds.height,
                oobKillMargin: parseFloat(oobInput.value),
                playableArea: {
                    x: parseFloat(paXInput.value) || 0,
                    y: parseFloat(paYInput.value) || 0,
                    width: parseFloat(paWInput.value) || bounds.playableArea.width,
                    height: parseFloat(paHInput.value) || bounds.playableArea.height,
                },
            },
            postProcess: {
                bloomIntensity: clamp01(parseFloat(bloomInput.value)),
                chromaticAberration: clamp01(parseFloat(caInput.value)),
                ambientLightColor: {
                    r: clampByte(parseInt(alrInput.value, 10)),
                    g: clampByte(parseInt(algInput.value, 10)),
                    b: clampByte(parseInt(albInput.value, 10)),
                },
                ambientLightIntensity: clamp01(parseFloat(aliInput.value)),
                vignetteIntensity: clamp01(parseFloat(vigInput.value)),
            },
            audio: {
                ambientLoop: ambientLoopInput.value.trim() || null,
                reverbProfile: reverbInput.value.trim() || audio.reverbProfile,
            },
        });
        if (cmd) onDispatch(cmd);
        close();
    });
    footer.appendChild(saveBtn);

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });

    nameInput.focus();

    function close(): void {
        document.body.removeChild(backdrop);
    }
}

function addSection(body: HTMLElement, label: string): void {
    const heading = document.createElement('div');
    heading.className = 'editor-modal-section';
    heading.textContent = label;
    body.appendChild(heading);
}

function addField(
    body: HTMLElement,
    label: string,
    value: string,
    type: string,
): HTMLInputElement {
    const row = document.createElement('div');
    row.className = 'editor-modal-field';

    const lbl = document.createElement('label');
    lbl.className = 'editor-modal-field-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement('input');
    input.type = type;
    if (type === 'number') input.step = 'any';
    input.value = value;
    input.className = 'editor-modal-input';
    row.appendChild(input);

    body.appendChild(row);
    return input;
}

function addRgbField(
    body: HTMLElement,
    label: string,
    color: { r: number; g: number; b: number },
): [HTMLInputElement, HTMLInputElement, HTMLInputElement] {
    const row = document.createElement('div');
    row.className = 'editor-modal-field';

    const lbl = document.createElement('label');
    lbl.className = 'editor-modal-field-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const group = document.createElement('div');
    group.className = 'editor-modal-rgb';
    row.appendChild(group);

    const r = makeRgbInput(String(color.r));
    const g = makeRgbInput(String(color.g));
    const b = makeRgbInput(String(color.b));

    for (const [ch, inp] of [['R', r], ['G', g], ['B', b]] as const) {
        const lbl2 = document.createElement('span');
        lbl2.className = 'editor-modal-rgb-label';
        lbl2.textContent = ch;
        group.appendChild(lbl2);
        group.appendChild(inp);
    }

    body.appendChild(row);
    return [r, g, b];
}

function makeRgbInput(value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '255';
    input.step = '1';
    input.value = value;
    input.className = 'editor-modal-input editor-modal-rgb-input';
    return input;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function clampByte(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(255, Math.round(n)));
}
