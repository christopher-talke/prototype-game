import './game-customizer.css';
import type { GameModeConfig, DeepPartial } from './types';
import { BASE_DEFAULTS } from './defaults';
import { deepMerge } from './activeConfig';
import { GAME_MODES } from './modes/index';
import { WEAPON_DEFS } from '../Combat/weapons';

const WEAPON_IDS = Object.keys(WEAPON_DEFS);
const GRENADE_TYPES: GrenadeType[] = ['FRAG', 'FLASH', 'SMOKE', 'C4'];

type FieldType = 'number' | 'boolean';

type FieldDescriptor = {
    section: string;
    key: string;
    label: string;
    type: FieldType;
    min?: number;
    max?: number;
    step?: number;
    toDisplay?: (v: number) => number;
    toStore?: (v: number) => number;
};

const msToSec = (v: number) => Math.round(v / 1000);
const secToMs = (v: number) => v * 1000;

const FIELDS: FieldDescriptor[] = [
    // Match
    { section: 'match', key: 'roundsToWin', label: 'Rounds to Win', type: 'number', min: 1, max: 30 },
    { section: 'match', key: 'roundDuration', label: 'Round Duration (s)', type: 'number', min: 20, max: 1200, toDisplay: msToSec, toStore: secToMs },
    { section: 'match', key: 'roundIntermission', label: 'Intermission (s)', type: 'number', min: 1, max: 30, toDisplay: msToSec, toStore: secToMs },
    { section: 'match', key: 'maxPlayers', label: 'Max Players', type: 'number', min: 2, max: 64 },
    { section: 'match', key: 'teamsCount', label: 'Teams', type: 'number', min: 2, max: 4 },
    { section: 'match', key: 'friendlyFire', label: 'Friendly Fire', type: 'boolean' },
    // Economy
    { section: 'economy', key: 'startingMoney', label: 'Starting Money', type: 'number', min: 0, max: 99999 },
    { section: 'economy', key: 'killRewardMultiplier', label: 'Kill Reward Mult', type: 'number', min: 0, max: 10, step: 0.1 },
    { section: 'economy', key: 'armorCost', label: 'Armor Cost', type: 'number', min: 0, max: 5000 },
    { section: 'economy', key: 'healthCost', label: 'Health Cost', type: 'number', min: 0, max: 5000 },
    { section: 'economy', key: 'disableArmor', label: 'Disable Armor Buy', type: 'boolean' },
    { section: 'economy', key: 'disableHealth', label: 'Disable Health Buy', type: 'boolean' },
    // Player
    { section: 'player', key: 'maxHealth', label: 'Max Health', type: 'number', min: 1, max: 1000 },
    { section: 'player', key: 'maxArmor', label: 'Max Armor', type: 'number', min: 0, max: 1000 },
    { section: 'player', key: 'startingArmor', label: 'Starting Armor', type: 'number', min: 0, max: 1000 },
    { section: 'player', key: 'speed', label: 'Move Speed', type: 'number', min: 1, max: 20, step: 0.5 },
    { section: 'player', key: 'respawnTime', label: 'Respawn Time (s)', type: 'number', min: 0, max: 60, toDisplay: msToSec, toStore: secToMs },
    { section: 'player', key: 'armorAbsorption', label: 'Armor Absorption', type: 'number', min: 0, max: 1, step: 0.05 },
    // Physics
    { section: 'physics', key: 'bulletSpeedMultiplier', label: 'Bullet Speed Mult', type: 'number', min: 0.1, max: 5, step: 0.1 },
    { section: 'physics', key: 'grenadeFriction', label: 'Grenade Friction', type: 'number', min: 0.5, max: 1, step: 0.01 },
    // Weapons (number fields only - checkboxes handled separately)
    { section: 'weapons', key: 'globalDamageMultiplier', label: 'Damage Mult', type: 'number', min: 0.1, max: 10, step: 0.1 },
    { section: 'weapons', key: 'recoilMultiplier', label: 'Recoil Mult', type: 'number', min: 0, max: 5, step: 0.1 },
    // Grenades (number fields only)
    { section: 'grenades', key: 'chargeTime', label: 'Charge Time (ms)', type: 'number', min: 100, max: 5000, step: 50 },
    { section: 'grenades', key: 'minThrowFraction', label: 'Min Throw Power', type: 'number', min: 0, max: 1, step: 0.05 },
    // AI
    { section: 'ai', key: 'speed', label: 'AI Speed', type: 'number', min: 1, max: 15, step: 0.5 },
    { section: 'ai', key: 'turnSpeed', label: 'Turn Speed', type: 'number', min: 1, max: 15, step: 0.5 },
    { section: 'ai', key: 'detectRange', label: 'Detect Range', type: 'number', min: 100, max: 3000 },
    { section: 'ai', key: 'fireCone', label: 'Fire Cone', type: 'number', min: 1, max: 45 },
    { section: 'ai', key: 'chaseTimeout', label: 'Chase Timeout (s)', type: 'number', min: 1, max: 30, toDisplay: msToSec, toStore: secToMs },
    { section: 'ai', key: 'patrolPause', label: 'Patrol Pause (s)', type: 'number', min: 0, max: 10, toDisplay: msToSec, toStore: secToMs },
];

const TABS: { id: string; label: string }[] = [
    { id: 'match', label: 'Match' },
    { id: 'economy', label: 'Economy' },
    { id: 'player', label: 'Player' },
    { id: 'physics', label: 'Physics' },
    { id: 'weapons', label: 'Weapons' },
    { id: 'grenades', label: 'Grenades' },
    { id: 'ai', label: 'AI' },
];

export type GameCustomizerOptions = {
    container: HTMLElement;
    baseModeId?: string;
    readonly?: boolean;
    showAISection?: boolean;
    compact?: boolean;
    onChange?: (partial: DeepPartial<GameModeConfig>) => void;
};

export type GameCustomizerInstance = {
    mount(): void;
    unmount(): void;
    getValue(): DeepPartial<GameModeConfig>;
    getResolvedConfig(): GameModeConfig;
    setBaseModeId(id: string): void;
    setReadonly(v: boolean): void;
    applyConfig(config: GameModeConfig): void;
};

export function createGameCustomizer(opts: GameCustomizerOptions): GameCustomizerInstance {
    let el: HTMLElement | null = null;
    let baseModeId = opts.baseModeId ?? 'tdm';
    let isReadonly = opts.readonly ?? false;
    let showAI = opts.showAISection ?? true;
    let resolvedBase = resolveMode(baseModeId);

    function resolveMode(modeId: string): GameModeConfig {
        const entry = GAME_MODES.find((m) => m.id === modeId);
        const partial = entry?.partial ?? {};
        return deepMerge(BASE_DEFAULTS, BASE_DEFAULTS, partial);
    }

    function getFieldValue(section: string, key: string): any {
        return (resolvedBase as any)[section]?.[key];
    }

    function readInput(id: string): string | null {
        const input = el?.querySelector<HTMLInputElement>(`#${id}`);
        return input?.value ?? null;
    }

    let activeTab = 'match';

    function buildHTML(): string {
        const modeOptions = GAME_MODES.map(
            (m) => `<option value="${m.id}" ${m.id === baseModeId ? 'selected' : ''}>${m.name}</option>`,
        ).join('');

        const visibleTabs = TABS.filter((t) => t.id !== 'ai' || showAI);

        const tabButtons = visibleTabs.map(
            (t) => `<button class="gc-tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`,
        ).join('');

        const panels = visibleTabs.map((t) => buildPanel(t)).join('');

        return `
            <div class="gc-mode-select">
                <label>Base Mode</label>
                <select id="gc-mode-dropdown" ${isReadonly ? 'disabled' : ''}>${modeOptions}</select>
            </div>
            <div class="gc-tabs">${tabButtons}</div>
            <div class="gc-body${opts.compact ? ' gc-compact' : ''}">${panels}</div>
        `;
    }

    function buildPanel(tab: { id: string; label: string }): string {
        const fields = FIELDS.filter((f) => f.section === tab.id);
        let body = fields.map((f) => buildField(f)).join('');

        if (tab.id === 'weapons') {
            body = buildWeaponCheckboxes() + body;
        }
        if (tab.id === 'grenades') {
            body = buildGrenadeCheckboxes() + body;
        }

        return `<div class="gc-panel${tab.id === activeTab ? ' active' : ''}" data-panel="${tab.id}">${body}</div>`;
    }

    function buildField(f: FieldDescriptor): string {
        const val = getFieldValue(f.section, f.key);
        const id = `gc-${f.section}-${f.key}`;

        if (f.type === 'boolean') {
            return `
                <div class="gc-row">
                    <label>${f.label}</label>
                    <div class="gc-toggle ${val ? 'active' : ''} ${isReadonly ? 'disabled' : ''}" id="${id}" data-field="${f.section}.${f.key}"></div>
                </div>
            `;
        }

        const displayVal = f.toDisplay ? f.toDisplay(val) : val;
        return `
            <div class="gc-row">
                <label>${f.label}</label>
                <input type="number" id="${id}" value="${displayVal}"
                    min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 1}"
                    ${isReadonly ? 'disabled' : ''} data-field="${f.section}.${f.key}" />
            </div>
        `;
    }

    function buildWeaponCheckboxes(): string {
        const allowed = resolvedBase.weapons.allowedWeapons;
        const isAll = allowed === 'ALL';
        const allowedSet = isAll ? new Set(WEAPON_IDS) : new Set(allowed);
        const starting = new Set(resolvedBase.weapons.startingWeapons);

        const allChip = `<div class="gc-chip all-toggle ${isAll ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}" data-wgroup="allowed" data-wid="ALL">ALL</div>`;
        const chips = WEAPON_IDS.map(
            (id) => `<div class="gc-chip ${allowedSet.has(id) ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}" data-wgroup="allowed" data-wid="${id}">${id}</div>`,
        ).join('');

        const startChips = WEAPON_IDS.map(
            (id) => `<div class="gc-chip ${starting.has(id) ? 'checked' : ''} ${!allowedSet.has(id) || isReadonly ? 'disabled' : ''}" data-wgroup="starting" data-wid="${id}">${id}</div>`,
        ).join('');

        return `
            <div class="gc-sub-label">Allowed Weapons</div>
            <div class="gc-checkbox-grid" id="gc-weapons-allowed">${allChip}${chips}</div>
            <div class="gc-sub-label">Starting Weapons</div>
            <div class="gc-checkbox-grid" id="gc-weapons-starting">${startChips}</div>
        `;
    }

    function buildGrenadeCheckboxes(): string {
        const allowed = resolvedBase.grenades.allowedGrenades;
        const isAll = allowed === 'ALL';
        const allowedSet = isAll ? new Set(GRENADE_TYPES) : new Set(allowed);
        const startCounts = resolvedBase.grenades.startingGrenades;

        const allChip = `<div class="gc-chip all-toggle ${isAll ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}" data-ggroup="allowed" data-gid="ALL">ALL</div>`;
        const chips = GRENADE_TYPES.map(
            (id) => `<div class="gc-chip ${allowedSet.has(id) ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}" data-ggroup="allowed" data-gid="${id}">${id}</div>`,
        ).join('');

        const counts = GRENADE_TYPES.map(
            (id) => `
            <div class="gc-grenade-count">
                <span>${id}</span>
                <input type="number" min="0" max="10" value="${startCounts[id] ?? 0}"
                    ${!allowedSet.has(id) || isReadonly ? 'disabled' : ''}
                    data-grenade-start="${id}" />
            </div>
        `,
        ).join('');

        return `
            <div class="gc-sub-label">Allowed Grenades</div>
            <div class="gc-checkbox-grid" id="gc-grenades-allowed">${allChip}${chips}</div>
            <div class="gc-sub-label">Starting Grenades</div>
            <div class="gc-grenade-counts">${counts}</div>
        `;
    }

    function wireEvents() {
        if (!el) return;

        // Tab switching
        el.querySelectorAll<HTMLElement>('.gc-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                el!.querySelectorAll('.gc-tab').forEach((t) => t.classList.remove('active'));
                el!.querySelectorAll('.gc-panel').forEach((p) => p.classList.remove('active'));
                tab.classList.add('active');
                activeTab = tab.getAttribute('data-tab') ?? 'match';
                el!.querySelector(`[data-panel="${activeTab}"]`)?.classList.add('active');
            });
        });

        // Mode dropdown
        el.querySelector('#gc-mode-dropdown')?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            baseModeId = select.value;
            resolvedBase = resolveMode(baseModeId);
            rebuildBody();
            opts.onChange?.(getValue());
        });

        // Boolean toggles
        el.querySelectorAll<HTMLElement>('.gc-toggle').forEach((toggle) => {
            toggle.addEventListener('click', () => {
                if (isReadonly) return;
                toggle.classList.toggle('active');
                opts.onChange?.(getValue());
            });
        });

        // Number inputs
        el.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach((input) => {
            input.addEventListener('change', () => {
                opts.onChange?.(getValue());
            });
        });

        wireWeaponEvents();
        wireGrenadeEvents();
    }

    function wireWeaponEvents() {
        if (!el) return;

        el.querySelectorAll<HTMLElement>('[data-wgroup="allowed"]').forEach((chip) => {
            chip.addEventListener('click', () => {
                if (isReadonly) return;
                const wid = chip.dataset.wid!;
                if (wid === 'ALL') {
                    const shouldCheck = !chip.classList.contains('checked');
                    chip.classList.toggle('checked', shouldCheck);
                    el!.querySelectorAll<HTMLElement>('[data-wgroup="allowed"]:not([data-wid="ALL"])').forEach((c) => {
                        c.classList.toggle('checked', shouldCheck);
                    });
                } else {
                    chip.classList.toggle('checked');
                    // Update ALL toggle
                    const allChecked = WEAPON_IDS.every((id) =>
                        el!.querySelector<HTMLElement>(`[data-wgroup="allowed"][data-wid="${id}"]`)?.classList.contains('checked'),
                    );
                    el!.querySelector<HTMLElement>('[data-wgroup="allowed"][data-wid="ALL"]')?.classList.toggle('checked', allChecked);
                }
                updateStartingWeaponStates();
                opts.onChange?.(getValue());
            });
        });

        el.querySelectorAll<HTMLElement>('[data-wgroup="starting"]').forEach((chip) => {
            chip.addEventListener('click', () => {
                if (isReadonly || chip.classList.contains('disabled')) return;
                chip.classList.toggle('checked');
                opts.onChange?.(getValue());
            });
        });
    }

    function updateStartingWeaponStates() {
        if (!el) return;
        WEAPON_IDS.forEach((id) => {
            const allowed = el!.querySelector<HTMLElement>(`[data-wgroup="allowed"][data-wid="${id}"]`)?.classList.contains('checked');
            const startChip = el!.querySelector<HTMLElement>(`[data-wgroup="starting"][data-wid="${id}"]`);
            if (startChip) {
                startChip.classList.toggle('disabled', !allowed || isReadonly);
                if (!allowed) startChip.classList.remove('checked');
            }
        });
    }

    function wireGrenadeEvents() {
        if (!el) return;

        el.querySelectorAll<HTMLElement>('[data-ggroup="allowed"]').forEach((chip) => {
            chip.addEventListener('click', () => {
                if (isReadonly) return;
                const gid = chip.dataset.gid!;
                if (gid === 'ALL') {
                    const shouldCheck = !chip.classList.contains('checked');
                    chip.classList.toggle('checked', shouldCheck);
                    el!.querySelectorAll<HTMLElement>('[data-ggroup="allowed"]:not([data-gid="ALL"])').forEach((c) => {
                        c.classList.toggle('checked', shouldCheck);
                    });
                } else {
                    chip.classList.toggle('checked');
                    const allChecked = GRENADE_TYPES.every((id) =>
                        el!.querySelector<HTMLElement>(`[data-ggroup="allowed"][data-gid="${id}"]`)?.classList.contains('checked'),
                    );
                    el!.querySelector<HTMLElement>('[data-ggroup="allowed"][data-gid="ALL"]')?.classList.toggle('checked', allChecked);
                }
                updateGrenadeCountStates();
                opts.onChange?.(getValue());
            });
        });
    }

    function updateGrenadeCountStates() {
        if (!el) return;
        GRENADE_TYPES.forEach((id) => {
            const allowed = el!.querySelector<HTMLElement>(`[data-ggroup="allowed"][data-gid="${id}"]`)?.classList.contains('checked');
            const input = el!.querySelector<HTMLInputElement>(`[data-grenade-start="${id}"]`);
            if (input) {
                input.disabled = !allowed || isReadonly;
                if (!allowed) input.value = '0';
            }
        });
    }

    function rebuildBody() {
        if (!el) return;
        el.innerHTML = buildHTML();
        wireEvents();
    }

    function readAllowedWeapons(): string[] | 'ALL' {
        if (!el) return 'ALL';
        const allToggle = el.querySelector<HTMLElement>('[data-wgroup="allowed"][data-wid="ALL"]');
        if (allToggle?.classList.contains('checked')) return 'ALL';
        return WEAPON_IDS.filter((id) =>
            el!.querySelector<HTMLElement>(`[data-wgroup="allowed"][data-wid="${id}"]`)?.classList.contains('checked'),
        );
    }

    function readStartingWeapons(): string[] {
        if (!el) return [];
        return WEAPON_IDS.filter((id) =>
            el!.querySelector<HTMLElement>(`[data-wgroup="starting"][data-wid="${id}"]`)?.classList.contains('checked'),
        );
    }

    function readAllowedGrenades(): GrenadeType[] | 'ALL' {
        if (!el) return 'ALL';
        const allToggle = el.querySelector<HTMLElement>('[data-ggroup="allowed"][data-gid="ALL"]');
        if (allToggle?.classList.contains('checked')) return 'ALL';
        return GRENADE_TYPES.filter((id) =>
            el!.querySelector<HTMLElement>(`[data-ggroup="allowed"][data-gid="${id}"]`)?.classList.contains('checked'),
        );
    }

    function readStartingGrenades(): Partial<Record<GrenadeType, number>> {
        if (!el) return {};
        const result: Partial<Record<GrenadeType, number>> = {};
        GRENADE_TYPES.forEach((id) => {
            const input = el!.querySelector<HTMLInputElement>(`[data-grenade-start="${id}"]`);
            if (input) {
                const v = Number(input.value) || 0;
                if (v > 0) result[id] = v;
            }
        });
        return result;
    }

    function getValue(): DeepPartial<GameModeConfig> {
        if (!el) return {};
        const partial: any = {};

        for (const f of FIELDS) {
            if (f.section === 'ai' && !showAI) continue;
            const baseVal = getFieldValue(f.section, f.key);

            let currentVal: any;
            const id = `gc-${f.section}-${f.key}`;

            if (f.type === 'boolean') {
                currentVal = el.querySelector<HTMLElement>(`#${id}`)?.classList.contains('active') ?? false;
            } else {
                const raw = readInput(id);
                if (raw === null) continue;
                const num = Number(raw);
                currentVal = f.toStore ? f.toStore(num) : num;
            }

            if (currentVal !== baseVal) {
                if (!partial[f.section]) partial[f.section] = {};
                partial[f.section][f.key] = currentVal;
            }
        }

        // Weapons checkboxes
        const allowedW = readAllowedWeapons();
        const baseAllowedW = resolvedBase.weapons.allowedWeapons;
        if (JSON.stringify(allowedW) !== JSON.stringify(baseAllowedW)) {
            if (!partial.weapons) partial.weapons = {};
            partial.weapons.allowedWeapons = allowedW;
        }

        const startingW = readStartingWeapons();
        const baseStartingW = resolvedBase.weapons.startingWeapons;
        if (JSON.stringify(startingW) !== JSON.stringify(baseStartingW)) {
            if (!partial.weapons) partial.weapons = {};
            partial.weapons.startingWeapons = startingW;
        }

        // Grenades checkboxes
        const allowedG = readAllowedGrenades();
        const baseAllowedG = resolvedBase.grenades.allowedGrenades;
        if (JSON.stringify(allowedG) !== JSON.stringify(baseAllowedG)) {
            if (!partial.grenades) partial.grenades = {};
            partial.grenades.allowedGrenades = allowedG;
        }

        const startingG = readStartingGrenades();
        const baseStartingG = resolvedBase.grenades.startingGrenades;
        if (JSON.stringify(startingG) !== JSON.stringify(baseStartingG)) {
            if (!partial.grenades) partial.grenades = {};
            partial.grenades.startingGrenades = startingG;
        }

        return partial;
    }

    function getResolvedConfig(): GameModeConfig {
        const partial = getValue();
        return deepMerge(BASE_DEFAULTS, resolvedBase, partial);
    }

    return {
        mount() {
            el = document.createElement('div');
            el.className = 'game-customizer';
            el.innerHTML = buildHTML();
            opts.container.appendChild(el);
            wireEvents();
        },

        unmount() {
            el?.remove();
            el = null;
        },

        getValue,
        getResolvedConfig,

        setBaseModeId(id: string) {
            baseModeId = id;
            resolvedBase = resolveMode(id);
            if (el) {
                const dropdown = el.querySelector<HTMLSelectElement>('#gc-mode-dropdown');
                if (dropdown) dropdown.value = id;
                rebuildBody();
            }
        },

        setReadonly(v: boolean) {
            isReadonly = v;
            if (el) rebuildBody();
        },

        applyConfig(config: GameModeConfig) {
            resolvedBase = config;
            if (el) rebuildBody();
        },
    };
}
