import { lightingConfig } from '@rendering/canvas/config/lightingConfig';

let panel: HTMLDivElement | null = null;

interface SliderDef {
    key: keyof typeof lightingConfig;
    label: string;
    min: number;
    max: number;
    step: number;
}

const sliders: SliderDef[] = [
    { key: 'ambientLevel',         label: 'Ambient',           min: 0,   max: 1,    step: 0.01 },
    { key: 'falloffExponent',      label: 'Falloff Curve',     min: 0.1, max: 5,    step: 0.1 },
    { key: 'coreSharpness',        label: 'Core Sharpness',    min: 0.01,max: 1,    step: 0.01 },
    { key: 'playerRadius',         label: 'Player Radius',     min: 50,  max: 800,  step: 10 },
    { key: 'playerIntensity',      label: 'Player Intensity',  min: 0.1, max: 3,    step: 0.05 },
    { key: 'fovRadius',            label: 'FOV Radius',        min: 100, max: 1500, step: 25 },
    { key: 'fovIntensity',         label: 'FOV Intensity',     min: 0.1, max: 5,    step: 0.1 },
    { key: 'fovSoftEdge',          label: 'FOV Soft Edge',     min: 0,   max: 30,   step: 1 },
    { key: 'lastKnownRadius',      label: 'LastKnown Radius',  min: 20,  max: 200,  step: 5 },
    { key: 'lastKnownIntensity',   label: 'LastKnown Intensity',min: 0.1,max: 2,    step: 0.05 },
];

function createRow(def: SliderDef): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0';

    const label = document.createElement('span');
    label.style.cssText = 'width:110px;font-size:11px;flex-shrink:0';
    label.textContent = def.label;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(lightingConfig[def.key]);
    input.style.cssText = 'flex:1;height:14px;accent-color:#6cf';

    const val = document.createElement('span');
    val.style.cssText = 'width:45px;font-size:11px;text-align:right;font-family:monospace';
    val.textContent = String(lightingConfig[def.key]);

    input.addEventListener('input', () => {
        const n = parseFloat(input.value);
        (lightingConfig as any)[def.key] = n;
        val.textContent = n % 1 === 0 ? String(n) : n.toFixed(2);
    });

    row.append(label, input, val);
    return row;
}

export function toggleLightingDebug() {
    if (panel) {
        panel.remove();
        panel = null;
        return;
    }

    panel = document.createElement('div');
    panel.id = 'lighting-debug-panel';
    panel.style.cssText = `
        position:fixed;top:10px;right:10px;z-index:99999;
        background:rgba(0,0,0,0.85);color:#ccc;padding:10px 12px;
        border-radius:6px;font-family:sans-serif;min-width:320px;
        pointer-events:auto;user-select:none;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-size:12px;font-weight:bold;margin-bottom:6px;color:#6cf';
    title.textContent = 'Lighting Debug';
    panel.appendChild(title);

    for (const def of sliders) {
        panel.appendChild(createRow(def));
    }

    const dump = document.createElement('button');
    dump.textContent = 'Copy Config';
    dump.style.cssText = 'margin-top:8px;font-size:11px;padding:3px 8px;cursor:pointer';
    dump.addEventListener('click', () => {
        const out: Record<string, number> = {};
        for (const def of sliders) out[def.key] = lightingConfig[def.key];
        navigator.clipboard.writeText(JSON.stringify(out, null, 2));
        dump.textContent = 'Copied!';
        setTimeout(() => dump.textContent = 'Copy Config', 1500);
    });
    panel.appendChild(dump);

    document.body.appendChild(panel);
}

// Toggle with F7
window.addEventListener('keydown', (e) => {
    if (e.key === 'F7') {
        e.preventDefault();
        toggleLightingDebug();
    }
});
