/**
 * Form generator: takes a list of FieldDescriptors and builds DOM inputs.
 *
 * Numeric inputs commit on blur or after a 300ms idle window so a single
 * keystroke doesn't dispatch a command per character.
 *
 * Part of the editor layer.
 */

import type { FieldDescriptor } from './fieldDescriptor';

const DEBOUNCE_MS = 300;

/** Render a list of field descriptors into `host`. Replaces previous contents. */
export function renderPropertyForm(host: HTMLElement, fields: FieldDescriptor[]): void {
    host.innerHTML = '';
    host.classList.add('editor-property-form');
    for (const f of fields) {
        host.appendChild(renderField(f));
    }
}

function renderField(field: FieldDescriptor): HTMLElement {
    const row = document.createElement('div');
    row.className = `editor-form-row editor-form-row-${field.type}`;

    const label = document.createElement('label');
    label.className = 'editor-form-label';
    label.textContent = field.label;
    row.appendChild(label);

    const control = buildControl(field);
    row.appendChild(control);

    if (field.warning) {
        const warn = document.createElement('div');
        warn.className = 'editor-form-warning';
        warn.textContent = field.warning;
        row.appendChild(warn);
    }

    return row;
}

function buildControl(field: FieldDescriptor): HTMLElement {
    switch (field.type) {
        case 'number':
            return numberControl(field);
        case 'text':
            return textControl(field);
        case 'enum':
            return enumControl(field);
        case 'bool':
            return boolControl(field);
        case 'color':
            return colorControl(field);
        case 'readonly':
            return readonlyControl(field.value);
        case 'guid':
            return guidControl(field.value);
    }
}

function numberControl(field: Extract<FieldDescriptor, { type: 'number' }>): HTMLElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'editor-form-control';
    input.value = String(field.value);
    if (field.step !== undefined) input.step = String(field.step);
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.disabled) input.disabled = true;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastCommitted = field.value;

    const commit = () => {
        const next = parseFloat(input.value);
        if (Number.isNaN(next) || next === lastCommitted) return;
        lastCommitted = next;
        field.onCommit(next);
    };

    input.addEventListener('input', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(commit, DEBOUNCE_MS);
    });
    input.addEventListener('blur', () => {
        if (timer) clearTimeout(timer);
        commit();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
    });

    return input;
}

function textControl(field: Extract<FieldDescriptor, { type: 'text' }>): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'editor-form-text-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'editor-form-control';
    input.value = field.value;
    if (field.disabled) input.disabled = true;

    const error = document.createElement('div');
    error.className = 'editor-form-error';

    let lastCommitted = field.value;

    const commit = () => {
        const next = input.value;
        if (next === lastCommitted) return;
        const issue = field.validate?.(next) ?? null;
        if (issue) {
            error.textContent = issue;
            return;
        }
        error.textContent = '';
        lastCommitted = next;
        field.onCommit(next);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
    });

    wrap.appendChild(input);
    wrap.appendChild(error);
    return wrap;
}

function enumControl(field: Extract<FieldDescriptor, { type: 'enum' }>): HTMLElement {
    const select = document.createElement('select');
    select.className = 'editor-form-control';
    if (field.disabled) select.disabled = true;
    for (const o of field.options) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (o.value === field.value) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', () => field.onCommit(select.value));
    return select;
}

function boolControl(field: Extract<FieldDescriptor, { type: 'bool' }>): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'editor-form-control editor-form-control-bool';
    input.checked = field.value;
    if (field.disabled) input.disabled = true;
    input.addEventListener('change', () => field.onCommit(input.checked));
    return input;
}

function colorControl(field: Extract<FieldDescriptor, { type: 'color' }>): HTMLElement {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'editor-form-control editor-form-control-color';
    input.value = rgbToHex(field.value);
    if (field.disabled) input.disabled = true;
    input.addEventListener('change', () => field.onCommit(hexToRgb(input.value)));
    return input;
}

function readonlyControl(value: string): HTMLElement {
    const span = document.createElement('div');
    span.className = 'editor-form-control editor-form-control-readonly';
    span.textContent = value;
    return span;
}

function guidControl(value: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'editor-form-control editor-form-control-guid';

    const text = document.createElement('span');
    text.textContent = value;
    wrap.appendChild(text);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'editor-form-copy';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
        void navigator.clipboard?.writeText(value);
    });
    wrap.appendChild(copy);

    return wrap;
}

function rgbToHex(c: { r: number; g: number; b: number }): string {
    const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    const v = parseInt(m[1], 16);
    return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}
