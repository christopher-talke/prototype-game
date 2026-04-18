/**
 * Secondary 28px toolbar directly below the top menu bar. Renders per-tool
 * options (Wall mode + thickness + type, Zone type, NavHint type + weight).
 * Empty for tools with no options (Select, Object, Entity, Light).
 *
 * Part of the editor layer.
 */

import type { NavHintType, WallType, ZoneType } from '@shared/map/MapData';

import type { ToolManager } from '../tools/toolManager';
import type { ToolSettingsStore, WallDrawMode, ZoneDrawMode } from '../tools/toolSettings';

const TOOL_BUTTONS: { id: string; label: string; title: string }[] = [
    { id: 'select', label: 'Select', title: 'Select (S)' },
    { id: 'wall', label: 'Wall', title: 'Wall Draw (W)' },
    { id: 'zone', label: 'Zone', title: 'Zone Draw (Z)' },
    { id: 'object', label: 'Object', title: 'Object Place (O)' },
    { id: 'entity', label: 'Entity', title: 'Entity Place (E)' },
    { id: 'light', label: 'Light', title: 'Light Place (L)' },
    { id: 'navHint', label: 'NavHint', title: 'NavHint Place (N)' },
];

const WALL_MODES: { id: WallDrawMode; label: string }[] = [
    { id: 'rect', label: 'Rect' },
    { id: 'line', label: 'Line' },
    { id: 'polygon', label: 'Polygon' },
];

const WALL_TYPES: WallType[] = ['concrete', 'metal', 'crate', 'sandbag', 'barrier', 'pillar'];

const ZONE_MODES: { id: ZoneDrawMode; label: string }[] = [
    { id: 'rect', label: 'Rect' },
    { id: 'polygon', label: 'Polygon' },
];

const ZONE_TYPES: ZoneType[] = [
    'spawn',
    'territory',
    'bombsite',
    'buyzone',
    'trigger',
    'extract',
    'audio',
    'floor-transition',
];

const NAV_HINT_TYPES: NavHintType[] = ['cover', 'choke', 'flank', 'danger', 'objective'];

/** Mount the options bar and wire to tool-change + settings-change events. */
export function mountToolOptionsBar(
    container: HTMLElement,
    toolManager: ToolManager,
    settings: ToolSettingsStore,
): () => void {
    const render = () => renderFor(container, toolManager.activeToolId(), settings, toolManager);
    const unsubTool = toolManager.subscribe(render);
    const unsubSettings = settings.subscribe(render);
    render();
    return () => {
        unsubTool();
        unsubSettings();
        container.innerHTML = '';
    };
}

function renderFor(
    container: HTMLElement,
    toolId: string,
    settings: ToolSettingsStore,
    toolManager: ToolManager,
): void {
    container.innerHTML = '';
    renderToolSelector(container, toolId, toolManager);
    switch (toolId) {
        case 'wall':
            renderWall(container, settings);
            return;
        case 'zone':
            renderZone(container, settings);
            return;
        case 'navHint':
            renderNavHint(container, settings);
            return;
    }
}

function renderToolSelector(container: HTMLElement, activeId: string, toolManager: ToolManager): void {
    const group = makeGroup('');
    for (const t of TOOL_BUTTONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = t.title;
        btn.className = `editor-tool-options-button${activeId === t.id ? ' active' : ''}`;
        btn.textContent = t.label;
        btn.addEventListener('click', () => toolManager.activate(t.id));
        group.appendChild(btn);
    }
    container.appendChild(group);
}

function renderWall(container: HTMLElement, settings: ToolSettingsStore): void {
    const s = settings.get().wall;

    const modeGroup = makeGroup('Mode');
    for (const mode of WALL_MODES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `editor-tool-options-button${s.mode === mode.id ? ' active' : ''}`;
        btn.textContent = mode.label;
        btn.addEventListener('click', () => settings.updateWall({ mode: mode.id }));
        modeGroup.appendChild(btn);
    }
    container.appendChild(modeGroup);

    const typeGroup = makeGroup('Type');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'editor-tool-options-select';
    for (const wt of WALL_TYPES) {
        const opt = document.createElement('option');
        opt.value = wt;
        opt.textContent = wt;
        if (wt === s.wallType) opt.selected = true;
        typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener('change', () =>
        settings.updateWall({ wallType: typeSelect.value as WallType }),
    );
    typeGroup.appendChild(typeSelect);
    container.appendChild(typeGroup);

    if (s.mode === 'line') {
        const thickGroup = makeGroup('Thickness');
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'editor-tool-options-input';
        input.min = '1';
        input.step = '1';
        input.value = String(s.thickness);
        input.addEventListener('change', () => {
            const n = Number.parseFloat(input.value);
            if (Number.isFinite(n) && n > 0) settings.updateWall({ thickness: n });
        });
        thickGroup.appendChild(input);
        container.appendChild(thickGroup);
    }
}

function renderZone(container: HTMLElement, settings: ToolSettingsStore): void {
    const s = settings.get().zone;

    const modeGroup = makeGroup('Mode');
    for (const mode of ZONE_MODES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `editor-tool-options-button${s.mode === mode.id ? ' active' : ''}`;
        btn.textContent = mode.label;
        btn.addEventListener('click', () => settings.updateZone({ mode: mode.id }));
        modeGroup.appendChild(btn);
    }
    container.appendChild(modeGroup);

    const typeGroup = makeGroup('Zone type');
    const select = document.createElement('select');
    select.className = 'editor-tool-options-select';
    for (const zt of ZONE_TYPES) {
        const opt = document.createElement('option');
        opt.value = zt;
        opt.textContent = zt;
        if (zt === s.zoneType) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', () =>
        settings.updateZone({ zoneType: select.value as ZoneType }),
    );
    typeGroup.appendChild(select);
    container.appendChild(typeGroup);
}

function renderNavHint(container: HTMLElement, settings: ToolSettingsStore): void {
    const s = settings.get().navHint;

    const typeGroup = makeGroup('Hint type');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'editor-tool-options-select';
    for (const t of NAV_HINT_TYPES) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === s.type) opt.selected = true;
        typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener('change', () =>
        settings.updateNavHint({ type: typeSelect.value as NavHintType }),
    );
    typeGroup.appendChild(typeSelect);
    container.appendChild(typeGroup);

    const weightGroup = makeGroup('Weight');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'editor-tool-options-input';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(s.weight);
    input.addEventListener('change', () => {
        const n = Number.parseFloat(input.value);
        if (Number.isFinite(n)) settings.updateNavHint({ weight: Math.max(0, Math.min(1, n)) });
    });
    weightGroup.appendChild(input);
    container.appendChild(weightGroup);
}

function makeGroup(labelText: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'editor-tool-options-group';
    const label = document.createElement('div');
    label.className = 'editor-tool-options-label';
    label.textContent = labelText;
    group.appendChild(label);
    return group;
}
