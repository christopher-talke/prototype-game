/**
 * Per-tool settings store.
 *
 * Keeps settings for Wall (mode, thickness, wallType), Zone (zoneType),
 * NavHint (type, weight) so the ToolOptionsBar can edit them and tools can
 * read them. Subscribers are notified on change; tools typically read on
 * demand rather than subscribing.
 *
 * Part of the editor layer.
 */

import type { NavHintType, WallType, ZoneType } from '@shared/map/MapData';

export type WallDrawMode = 'rect' | 'line' | 'polygon';
export type ZoneDrawMode = 'rect' | 'polygon';

export interface WallToolSettings {
    mode: WallDrawMode;
    thickness: number;
    wallType: WallType;
}

export interface ZoneToolSettings {
    mode: ZoneDrawMode;
    zoneType: ZoneType;
}

export interface NavHintToolSettings {
    type: NavHintType;
    weight: number;
}

export interface ToolSettings {
    wall: WallToolSettings;
    zone: ZoneToolSettings;
    navHint: NavHintToolSettings;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
    wall: { mode: 'rect', thickness: 16, wallType: 'concrete' },
    zone: { mode: 'rect', zoneType: 'spawn' },
    navHint: { type: 'cover', weight: 0.5 },
};

type Listener = () => void;

export class ToolSettingsStore {
    private settings: ToolSettings;
    private listeners = new Set<Listener>();

    constructor(initial: ToolSettings = DEFAULT_TOOL_SETTINGS) {
        this.settings = structuredClone(initial);
    }

    get(): ToolSettings {
        return this.settings;
    }

    updateWall(patch: Partial<WallToolSettings>): void {
        this.settings.wall = { ...this.settings.wall, ...patch };
        this.notify();
    }

    updateZone(patch: Partial<ZoneToolSettings>): void {
        this.settings.zone = { ...this.settings.zone, ...patch };
        this.notify();
    }

    updateNavHint(patch: Partial<NavHintToolSettings>): void {
        this.settings.navHint = { ...this.settings.navHint, ...patch };
        this.notify();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const l of this.listeners) l();
    }
}
